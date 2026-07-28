"use client";
import {useEffect,useMemo,useState} from "react";
import destinations from "@/data/destinations.json";

type Video={id:string,title:string,channel:string,publishedAt:string,views:number,thumb:string,relevance:number};
type WeatherDay={date:string,max:number,min:number,rain:number,code:number};
type Data={destination:any,weather:{last7:WeatherDay[],next7:WeatherDay[],rain7:number,rainNext7:number,nextAvg:number,rainyDays:number,score:number}};
const codeIcon=(c:number)=>c===0?"☀️":c<=3?"🌤️":c<=48?"🌫️":c<=67?"🌧️":c<=77?"🌨️":"⛈️";
const shortDate=(s:string)=>new Date(s+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric"});
const ago=(s:string)=>{const d=(Date.now()-new Date(s).getTime())/864e5;if(d<1)return `${Math.max(1,Math.round(d*24))}h ago`;return `${Math.round(d)}d ago`};
function decision(score:number){return score>=75?["GO","Strong conditions for a trip","good"]:score>=55?["MAYBE","Check rain and local conditions","maybe"]:["WAIT","Weather needs attention","wait"]}

export default function Home(){
 const [query,setQuery]=useState(""); const [state,setState]=useState("All India"); const [selected,setSelected]=useState<any>(destinations.find(x=>x.name==="Chikmagalur")||destinations[0]);
 const [data,setData]=useState<Data|null>(null); const [videos,setVideos]=useState<{recent:Video[],best:Video[]}>({recent:[],best:[]});
 const [loading,setLoading]=useState(false); const [vloading,setVloading]=useState(false); const [videoError,setVideoError]=useState(""); const [weatherError,setWeatherError]=useState(""); const [activeVideo,setActiveVideo]=useState<Video|null>(null);
 const states=useMemo(()=>["All India",...Array.from(new Set(destinations.map(x=>x.state))).sort()],[ ]);
 const filtered=useMemo(()=>destinations.filter(x=>(state==="All India"||x.state===state)&&(!query||x.name.toLowerCase().includes(query.toLowerCase())||x.state.toLowerCase().includes(query.toLowerCase()))).slice(0,120),[state,query]);

 async function load(d:any){
   setSelected(d);setLoading(true);setVloading(true);setData(null);setVideos({recent:[],best:[]});setVideoError("");setWeatherError("");
   const weatherPromise=fetch(`/api/destination?slug=${encodeURIComponent(d.slug)}`).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Weather request failed");return j});
   const videoPromise=fetch(`/api/videos?place=${encodeURIComponent(d.name)}`).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"YouTube request failed");return j});
   try{setData(await weatherPromise)}catch(e:any){setWeatherError(e?.message||"Weather could not be loaded")}
   setLoading(false);
   try{const j=await videoPromise;setVideos({recent:j.recent||[],best:j.best||[]});if(!(j.recent?.length||j.best?.length))setVideoError("YouTube returned no usable travel videos for this destination. Try another place or check the YouTube API quota/key.")}catch(e:any){setVideoError(e?.message||"YouTube videos could not be loaded")}
   setVloading(false);
 }
 useEffect(()=>{load(selected)},[]);
 const all=[...(videos.recent||[])]; const heroVideo=all[0]||videos.best[0]; const score=data?.weather.score||0; const [label,reason]=decision(score);
 return <><nav className="nav"><div className="brand">🌍 WanderGuide</div><div className="navlinks"><span className="livepill">● Live weather + video</span><span>Explore</span><span>Top 10</span><span>My Trip</span></div></nav>
 <main className="shell">
  <section className="hero"><div className="eyebrow">INDIA TRAVEL WEATHER</div><div className="heroGrid"><div><h1>Where should you go <span>right now?</span></h1><p>See the forecast and recent traveller footage together — without digging through pages.</p></div><div className="controls"><select className="select" value={state} onChange={e=>setState(e.target.value)}>{states.map(s=><option key={s}>{s}</option>)}</select><select className="select" value={selected.state} onChange={e=>{setState(e.target.value);const d=destinations.find(x=>x.state===e.target.value);if(d)load(d)}}><option value={selected.state}>{selected.state}</option>{states.filter(s=>s!=="All India"&&s!==selected.state).map(s=><option key={s}>{s}</option>)}</select><input className="search" placeholder="Search place..." value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
   <div className="chips">{filtered.slice(0,10).map(x=><button key={x.slug} className={"chip "+(x.slug===selected.slug?"active":"")} onClick={()=>load(x)}><b>{x.name}</b><small>{x.state}</small></button>)}<span className="placecount">{filtered.length < destinations.length ? `${filtered.length}+ matches` : `${destinations.length}+ places`}</span></div>
  </section>

  <div className="layout">
   <div>
    <section className="card videoHero">
      <div className="player">{heroVideo?<iframe src={`https://www.youtube-nocookie.com/embed/${heroVideo.id}?rel=0&modestbranding=1&playsinline=1`} title={heroVideo.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>:<div className="playerEmpty">{vloading?"Finding fresh traveller videos…":"No embeddable video found"}</div>}</div>
      {heroVideo&&<div className="videoMeta"><div className="videoMetaRow"><div><b>{heroVideo.title}</b><div className="muted">{heroVideo.channel} · {ago(heroVideo.publishedAt)}</div></div><span className="badge high">{all[0]?"FRESH EVIDENCE":"BEST AVAILABLE"}</span></div></div>}
    </section>
    {videoError&&<div className="errorbox"><b>Video search problem</b><span>{videoError}</span><small>This version uses a minimal YouTube search request and verifies embedding separately. Check the API key/project and restart <code>npm run dev</code> after editing <code>.env.local</code>.</small></div>}
    <section className="card cardpad" style={{marginTop:18}}><div className="sectionhead"><div><h2>Recent traveller videos · last 30 days</h2><div className="muted">Fresh footage only. Videos are opened inside WanderGuide.</div></div><span className="badge high">{videos.recent.length} FRESH</span></div>
      <div className="recentRow" style={{marginTop:12}}>{vloading?<div className="loading">Searching YouTube for {selected.name}…</div>:videos.recent.length?videos.recent.map(v=><VideoCard key={v.id} v={v} onClick={()=>setActiveVideo(v)}/>):<div className="loading">No fresh videos found in the last 30 days. See Top 10 below for the best available travel evidence.</div>}</div>
    </section>
    <section className="card cardpad" style={{marginTop:18}}><div className="sectionhead"><div><h2>Top 10 best travel videos</h2><div className="muted">Ranked by destination relevance, travel intent and views. Shorts are heavily down-ranked.</div></div><span className="badge">{videos.best.length} RANKED</span></div>
      <div className="grid3" style={{marginTop:12}}>{videos.best.length?videos.best.map(v=><VideoCard key={v.id} v={v} onClick={()=>setActiveVideo(v)}/>):<div className="loading">No ranked videos available.</div>}</div>
    </section>
   </div>
   <aside className="side">
    <section className="card cardpad"><div className="destinationTitle"><div><div className="eyebrow">DESTINATION</div><h2>{selected.name}</h2><div className="muted">{selected.state}, India</div></div><div className="score">{score}/100</div></div>
     <div className="decision"><div><b>{label}</b><div className="muted">{reason}</div></div><span className="badge high">{label==="GO"?"GOOD":label==="MAYBE"?"CHECK":"WAIT"}</span></div>
     <div className="stats"><div className="stat"><b>{data?.weather.rain7?.toFixed(0)??"—"}mm</b><span className="muted">rain last 7d</span></div><div className="stat"><b>{data?.weather.rainNext7?.toFixed(0)??"—"}mm</b><span className="muted">rain next 7d</span></div><div className="stat"><b>{data?.weather.rainyDays??"—"}</b><span className="muted">rainy days ahead</span></div></div>
     {weatherError&&<div className="inlineError">{weatherError}</div>}
    </section>
    <section className="card cardpad"><div className="sectionhead"><h2>Top places to see</h2><span className="muted">{destinations.length}+ indexed</span></div><div className="places" style={{marginTop:10}}>{filtered.slice(0,20).map(p=><div className="place" key={p.slug} onClick={()=>load(p)}><b>{p.name}</b><span>{p.state}</span></div>)}</div></section>
   </aside>
  </div>

  <section className="card cardpad weather"><div className="sectionhead"><div><div className="eyebrow">WEATHER CONTEXT</div><h2 style={{margin:"5px 0"}}>Last 7 days → Next 7 days</h2></div><div style={{fontSize:24}}>{data?.weather.next7?.[0]&&codeIcon(data.weather.next7[0].code)} {data?.weather.next7?.[0]?.max??"—"}°</div></div>
   {loading?<div className="loading">Loading 14-day weather…</div>:data&&<><h3 style={{fontSize:12,margin:"18px 0 8px"}}>NEXT 7 DAYS</h3><div className="days">{data.weather.next7.map(d=><Day key={d.date} d={d}/>)}</div>
   <h3 style={{fontSize:12,margin:"18px 0 8px"}}>LAST 7 DAYS · {data.weather.rain7.toFixed(0)}mm total rain</h3><div className="rainchart">{data.weather.last7.map(d=><div key={d.date} className="bar" title={`${d.date}: ${d.rain.toFixed(1)}mm`} style={{height:`${Math.max(5,Math.min(100,d.rain/(Math.max(...data.weather.last7.map(x=>x.rain),1))*100))}%`}}/>)}</div><div className="days">{data.weather.last7.map(d=><Day key={d.date} d={d}/>)}</div></>}
   {data&&<div className="decision"><div><b>Weather score {data.weather.score}/100</b><div className="muted">The decision emphasizes the next 7 days, while the last 7 days provides real weather context.</div></div></div>}
  </section>
  <section className="card cardpad" style={{marginTop:18}}><div className="sectionhead"><div><div className="eyebrow">INDIA DESTINATION INDEX</div><h2 style={{margin:"5px 0"}}>Explore {destinations.length}+ cities & travel places</h2></div><span className="muted">Search across India or filter by state</span></div><div className="places" style={{gridTemplateColumns:"repeat(5,1fr)",marginTop:12}}>{filtered.slice(0,50).map(p=><div className="place" key={p.slug} onClick={()=>load(p)}><b>{p.name}</b><span>{p.state}</span></div>)}</div></section>
  <div className="footer">Weather data: Open-Meteo. Video discovery: YouTube Data API v3. Videos are filtered for embeddability and played in WanderGuide's in-app player.</div>
 </main>
 {activeVideo&&<div className="modal" onClick={()=>setActiveVideo(null)}><div className="modalbox" onClick={e=>e.stopPropagation()}><div className="modalplayer"><iframe src={`https://www.youtube-nocookie.com/embed/${activeVideo.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`} title={activeVideo.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen/></div><div className="modalbar"><div><b>{activeVideo.title}</b><div className="muted">{activeVideo.channel} · {ago(activeVideo.publishedAt)}</div></div><button className="close" onClick={()=>setActiveVideo(null)}>Close</button></div></div></div>}
 </>
}
function Day({d}:{d:WeatherDay}){return <div className="day"><div className="date">{shortDate(d.date)}</div><div className="icon">{codeIcon(d.code)}</div><strong>{d.max}°</strong><small>{d.rain.toFixed(1)}mm rain</small></div>}
function VideoCard({v,onClick}:{v:Video,onClick:()=>void}){return <div className="thumb" onClick={onClick}><img src={v.thumb} alt=""/><div className="t">{v.title}</div><div className="m">{v.channel} · {ago(v.publishedAt)} · {v.views.toLocaleString()} views</div></div>}
