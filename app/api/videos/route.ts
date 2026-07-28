import {NextRequest,NextResponse} from "next/server";
type Video={id:string;title:string;channel:string;publishedAt:string;thumbnail:string;views:number};
type Payload={latest:Video[];mostViewed:Video[];candidateCount:number;fresh7:number};
const cache=new Map<string,{expires:number;payload:Payload}>();
async function yt(resource:string,params:Record<string,string>){
 const u=new URL(`https://www.googleapis.com/youtube/v3/${resource}`);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
 const r=await fetch(u,{cache:"no-store"}),b=await r.json();
 if(!r.ok){const reason=b?.error?.errors?.[0]?.reason||b?.error?.status||"YouTube API error";throw new Error(`YouTube API: ${reason} — ${b?.error?.message||"request failed"}`)}return b;
}
const daysAgo=(iso:string)=>(Date.now()-new Date(iso).getTime())/86400000;
export async function GET(req:NextRequest){
 const place=(req.nextUrl.searchParams.get("place")||"").trim(),key=process.env.YOUTUBE_API_KEY?.trim();
 if(!place)return NextResponse.json({error:"place is required"},{status:400});
 if(!key||key==="YOUR_YOUTUBE_API_KEY")return NextResponse.json({error:"YOUTUBE_API_KEY is missing"},{status:500});
 const ck=place.toLowerCase(),hit=cache.get(ck);if(hit&&hit.expires>Date.now())return NextResponse.json({...hit.payload,cached:true});
 try{
  // Keep search quota low: a single search request supplies candidates for both tabs.
  const s=await yt("search",{part:"snippet",q:`${place} travel tourism vlog places`,type:"video",order:"relevance",maxResults:"50",key});
  const ids:string[]=(s.items||[]).map((x:any)=>x?.id?.videoId).filter((x:unknown):x is string=>typeof x==="string"&&x.length>0);
  const d=ids.length?await yt("videos",{part:"snippet,statistics,status",id:ids.join(","),key}):{items:[]};
  const videos:Video[]=(d.items||[]).filter((x:any)=>x.status?.embeddable===true).map((x:any)=>({id:x.id,title:x.snippet?.title||"Travel video",channel:x.snippet?.channelTitle||"",publishedAt:x.snippet?.publishedAt||"",thumbnail:x.snippet?.thumbnails?.high?.url||x.snippet?.thumbnails?.medium?.url||"",views:Number(x.statistics?.viewCount||0)}));
  const latest=videos.slice().sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,10);
  const mostViewed=videos.slice().sort((a,b)=>b.views-a.views).slice(0,10);
  const payload={latest,mostViewed,candidateCount:videos.length,fresh7:videos.filter(v=>daysAgo(v.publishedAt)<=7).length};
  cache.set(ck,{expires:Date.now()+Math.max(30,Number(process.env.YOUTUBE_CACHE_MINUTES||360))*60000,payload});
  return NextResponse.json(payload);
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Video search failed"},{status:502})}
}