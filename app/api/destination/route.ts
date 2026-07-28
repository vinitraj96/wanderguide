
import { NextRequest, NextResponse } from "next/server";
import destinations from "@/data/destinations.json";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const d = destinations.find(x => x.slug === slug);
  if (!d) return NextResponse.json({error:"Destination not found"}, {status:404});

  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate()-7);
  const end = new Date(today); end.setDate(today.getDate()+7);
  const fmt=(x:Date)=>x.toISOString().slice(0,10);

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lon}&past_days=7&forecast_days=7&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum&timezone=auto`;
  const r = await fetch(url,{next:{revalidate:1800}});
  if(!r.ok) return NextResponse.json({error:"Weather provider failed"},{status:502});
  const w = await r.json();

  const days = (w.daily.time as string[]).map((date:string,i:number)=>({
    date, max:Math.round(w.daily.temperature_2m_max[i]), min:Math.round(w.daily.temperature_2m_min[i]),
    rain:Number(w.daily.precipitation_sum[i]||0), code:w.daily.weather_code[i]
  }));
  const last7=days.slice(0,7), next7=days.slice(7,14);
  const rain7=last7.reduce((a,b)=>a+b.rain,0), rainNext7=next7.reduce((a,b)=>a+b.rain,0);
  const nextAvg=Math.round(next7.reduce((a,b)=>a+b.max,0)/next7.length);
  const rainyDays=next7.filter(x=>x.rain>=2 || [61,63,65,80,81,82].includes(x.code)).length;
  const weatherScore=Math.max(35, Math.min(95, 82 - rainyDays*5 - Math.max(0,rainNext7-35)*0.5));

  return NextResponse.json({
    destination:d, timezone:w.timezone, weather:{last7,next7,rain7,rainNext7,nextAvg,rainyDays,score:Math.round(weatherScore)}
  });
}
