import {NextRequest,NextResponse} from "next/server";

const FALLBACK="";

export async function GET(req:NextRequest){
  const place=(req.nextUrl.searchParams.get("place")||"").trim();
  if(!place)return NextResponse.json({image:FALLBACK});
  try{
    const title=encodeURIComponent(place);
    const url=`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
    const r=await fetch(url,{headers:{"User-Agent":"WanderGuide/1.0"},next:{revalidate:86400}});
    if(r.ok){
      const x=await r.json();
      const image=x?.originalimage?.source||x?.thumbnail?.source||FALLBACK;
      return NextResponse.json({image},{headers:{"Cache-Control":"public, s-maxage=86400, stale-while-revalidate=604800"}});
    }
    // Search Wikipedia if the exact page title did not resolve.
    const s=await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(place)}&gsrlimit=1&prop=pageimages&piprop=original|thumbnail&pithumbsize=1000&format=json&origin=*`,{next:{revalidate:86400}});
    if(!s.ok)return NextResponse.json({image:FALLBACK});
    const j=await s.json();const pages=Object.values(j?.query?.pages||{}) as any[];
    return NextResponse.json({image:pages[0]?.original?.source||pages[0]?.thumbnail?.source||FALLBACK},{headers:{"Cache-Control":"public, s-maxage=86400, stale-while-revalidate=604800"}});
  }catch{return NextResponse.json({image:FALLBACK})}
}