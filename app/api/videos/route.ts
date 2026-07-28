import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type CacheEntry = {
  expiresAt: number;
  data: any;
};

type Video = {
  id: string;
  title: string;
  channel: string;
  publishedAt: string;
  views: number;
  thumb: string;
  relevance: number;
  embeddable: boolean;
};

const cache = new Map<string, CacheEntry>();

function agoDate(days: number) {
  return new Date(Date.now() - days * DAY).toISOString();
}

function getNumber(name: string, fallback: number, max = 50) {
  const n = Number(process.env[name] || fallback);
  return Math.min(Math.max(Number.isFinite(n) ? n : fallback, 1), max);
}

async function youtube(path: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), { cache: "no-store" });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason =
      body?.error?.errors?.[0]?.reason ||
      body?.error?.status ||
      `HTTP_${response.status}`;
    const message =
      body?.error?.message ||
      "YouTube Data API request failed";
    throw new Error(`YouTube API: ${reason} — ${message}`);
  }

  return body;
}

/**
 * IMPORTANT:
 * This search request intentionally uses ONLY the basic parameters below.
 *
 * We do not send:
 * - videoEmbeddable
 * - videoSyndicated
 * - regionCode
 * - relevanceLanguage
 * - publishedAfter
 * - order
 * - type
 *
 * This removes the source of the invalidFilters error completely.
 *
 * We filter the returned results locally and verify embedding with
 * videos.list/status.embeddable.
 */
async function basicSearch(key: string, q: string, maxResults: number) {
  // Canonical YouTube video search:
  // part + q + type=video + maxResults + key.
  //
  // Deliberately NO:
  // videoEmbeddable, videoSyndicated, order, publishedAfter,
  // regionCode, relevanceLanguage, videoCategoryId, etc.
  //
  // Embeddability is checked later with videos.list -> status.embeddable.
  return youtube("search", {
    part: "snippet",
    q,
    type: "video",
    maxResults: String(Math.min(Math.max(maxResults, 1), 50)),
    key,
  });
}

async function videoDetails(key: string, ids: string[]) {
  if (!ids.length) return [];

  // videos.list costs far less quota than search.list and is used only
  // for IDs returned by search.
  const body = await youtube("videos", {
    part: "snippet,statistics,status",
    id: ids.join(","),
    key,
  });

  return body.items || [];
}

function relevance(video: any, place: string) {
  const title = String(video.snippet?.title || "");
  const description = String(video.snippet?.description || "");
  const text = `${title} ${description}`.toLowerCase();
  const p = place.toLowerCase().trim();

  let score = 0;

  if (text.includes(p)) score += 60;

  for (const word of p.split(/\s+/).filter(w => w.length > 2)) {
    if (text.includes(word)) score += 12;
  }

  if (
    /\btravel\b|\btraveller\b|\btraveler\b|\btrip\b|\bvlog\b|\btour\b|\btourism\b|\bvisit\b|\bplaces to visit\b|\broad trip\b|\btrek\b|\bitinerary\b|\bexplore\b|\bmonsoon\b|\bwaterfall\b|\bbeach\b|\bmountain\b|\bhill station\b/
      .test(text)
  ) {
    score += 25;
  }

  if (/#shorts\b|\bshorts\b|\bshort video\b/.test(text)) score -= 30;

  if (
    /\bgaming\b|\bgameplay\b|\breaction\b|\bmusic video\b|\bsong\b|\bstatus\b|\bmovie\b|\bfilm trailer\b|\bserial\b|\bnews\b/
      .test(text)
  ) {
    score -= 60;
  }

  return score;
}

function toVideo(item: any, place: string): Video | null {
  if (!item?.id) return null;

  // This is the authoritative embedding check.
  if (item.status?.embeddable === false) return null;

  return {
    id: item.id,
    title: item.snippet?.title || "Travel video",
    channel: item.snippet?.channelTitle || "YouTube creator",
    publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
    views: Number(item.statistics?.viewCount || 0),
    thumb:
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.medium?.url ||
      `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    relevance: relevance(item, place),
    embeddable: true,
  };
}

function unique(videos: Video[]) {
  const map = new Map<string, Video>();
  for (const video of videos) {
    map.set(video.id, video);
  }
  return Array.from(map.values());
}

function cacheKey(place: string) {
  return place.toLowerCase().trim();
}

export async function GET(req: NextRequest) {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  const place = req.nextUrl.searchParams.get("place")?.trim();

  if (!key || key === "YOUR_YOUTUBE_API_KEY") {
    return NextResponse.json(
      {
        error:
          "YOUTUBE_API_KEY is missing. Put your real YouTube Data API v3 key in .env.local and restart npm run dev.",
      },
      { status: 503 }
    );
  }

  if (!place) {
    return NextResponse.json({ error: "Missing place" }, { status: 400 });
  }

  const cacheMinutes = Math.max(
    Number(process.env.YOUTUBE_CACHE_MINUTES || 360),
    5
  );
  const existing = cache.get(cacheKey(place));

  if (existing && existing.expiresAt > Date.now()) {
    return NextResponse.json(
      { ...existing.data, cached: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const maxResults = getNumber("YOUTUBE_MAX_RESULTS", 50);
  const recentMax = Math.min(
    getNumber("YOUTUBE_RECENT_RESULTS", 20),
    maxResults
  );
  const bestMax = Math.min(
    getNumber("YOUTUBE_BEST_RESULTS", 20),
    maxResults
  );

  try {
    /*
     * Only ONE search.list call on a cache miss.
     *
     * Recent search: search broadly and filter by date locally.
     * Best search: search broadly and rank locally.
     *
     * This means changing the new API key cannot reintroduce invalidFilters,
     * because only the documented type=video filter is sent.
     */
    // One canonical search per destination. This is intentionally simple:
    // it prevents invalid filter combinations and also halves search quota
    // consumption compared with the previous two-search implementation.
    const searchMax = Math.max(recentMax, bestMax, 20);
    const raw = await basicSearch(
      key,
      `${place} travel vlog`,
      Math.min(searchMax, 50)
    );

    const candidates = (raw.items || [])
      .filter((x: any) => x.id?.kind === "youtube#video" && x.id?.videoId)
      .map((x: any) => x.id.videoId);

    const recentCandidates = candidates;
    const bestCandidates = candidates;

    const ids = [...new Set([...recentCandidates, ...bestCandidates])];
    const details = await videoDetails(key, ids);
    const byId = new Map(details.map((x: any) => [x.id, x]));

    const recentCutoff = Date.now() - 30 * DAY;

    const allRecent = unique(
      recentCandidates
        .map(id => toVideo(byId.get(id), place))
        .filter(Boolean) as Video[]
    );

    const allBest = unique(
      bestCandidates
        .map(id => toVideo(byId.get(id), place))
        .filter(Boolean) as Video[]
    );

    const recent = allRecent
      .filter(v => new Date(v.publishedAt).getTime() >= recentCutoff)
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() -
          new Date(a.publishedAt).getTime()
      )
      .slice(0, 10);

    const best = allBest
      .sort((a, b) => {
        const scoreA =
          a.relevance * 5 + Math.log10(a.views + 1) * 8;
        const scoreB =
          b.relevance * 5 + Math.log10(b.views + 1) * 8;
        return scoreB - scoreA;
      })
      .slice(0, 10);

    const data = {
      recent,
      best,
      source: "YouTube Data API v3",
      cached: false,
      debug: {
        searchRequests: 1,
        candidates: ids.length,
        embeddable: details.filter(
          (x: any) => x.status?.embeddable !== false
        ).length,
      },
    };

    cache.set(cacheKey(place), {
      expiresAt: Date.now() + cacheMinutes * 60 * 1000,
      data,
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    const message = e?.message || "YouTube search failed";

    // Give a much more useful message for the common quota problem.
    if (/quota|rateLimitExceeded/i.test(message)) {
      return NextResponse.json(
        {
          error:
            `${message}\n\nWanderGuide uses cached results after a successful search. ` +
            `If this is a new API key, check that YouTube Data API v3 is enabled in the SAME Google Cloud project as the key and that the project has available quota.`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: message,
        diagnostic: {
          endpoint: "youtube/v3/search",
          parametersUsed: ["part=snippet", "q", "type=video", "maxResults", "key"],
          optionalFiltersUsed: [],
          note:
            "If this exact request still returns invalidFilters, verify the API key is a YouTube Data API v3 key and that no proxy, extension, or copied code is modifying the request.",
        },
      },
      { status: 502 }
    );
  }
}
