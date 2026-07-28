# WanderGuide v11

## YouTube API request rebuilt

The video endpoint now makes exactly one canonical `search.list` request per
cache miss:

```text
part=snippet
q=Chikmagalur travel vlog
type=video
maxResults=20
key=YOUR_KEY
```

No other YouTube search filters are sent.

After search, `videos.list` checks `status.embeddable` and retrieves title,
channel, date, views and thumbnails.

Recent videos are selected locally from the returned results using the last
30 days. Best videos are ranked locally.

## Setup

Use a fresh folder for v11.

```cmd
npm install
```

Create/edit `.env.local`:

```env
YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY
YOUTUBE_MAX_RESULTS=50
YOUTUBE_RECENT_RESULTS=20
YOUTUBE_BEST_RESULTS=20
YOUTUBE_CACHE_MINUTES=360
```

Then:

```cmd
npm run dev
```

Open:

```text
http://localhost:3000
```

### Important when upgrading from v10

Stop the old server, extract v11 into a new directory, and run it there.
If you reuse the old directory, delete `.next` before starting:

```cmd
rmdir /s /q .next
npm run dev
```

If the API returns `invalidFilters` even for the canonical request above, the
response now includes a diagnostic showing exactly which parameters the app
uses.

## Google Cloud checks

Make sure:
- YouTube Data API v3 is enabled.
- The API key is from the same Google Cloud project.
- The project has available YouTube quota.
- API key restrictions, if enabled, allow YouTube Data API v3.

Do not put the key in `NEXT_PUBLIC_YOUTUBE_API_KEY`.
