"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Destination={id:string;name:string;country:string;countryCode:string;region:string;lat:number;lon:number;population?:number;slug:string;attractions?:string[];category?:string};
type Day={date:string;max:number;min:number;rain:number;code:number};
type Video={id:string;title:string;channel:string;publishedAt:string;thumbnail:string;views:number};
type DRes={destination:Destination;weather:{days:Day[];history30?:Day[]};decisionScore:number;predictedPlaces:Array<Destination&{score:number}>};
type CompareItem={destination:Destination;score:number;rain:number;best:string;videos:number};
type Discovery={destination:Destination;score:number;distance:number;rain:number;best:string;rankScore?:number;tourism?:number;distanceFit?:number;styleFit?:number;reason?:string;warning?:string;confidence?:string;image?:string;videoCount?:number;travelMode?:string;travelHours?:number;practicality?:number};

const wx=(c:number)=>[95,96,99].includes(c)?"⛈️":[51,53,55,61,63,65,80,81,82].includes(c)?"🌧️":[71,73,75,77,85,86].includes(c)?"❄️":[45,48].includes(c)?"🌫️":[1,2,3].includes(c)?"⛅":"☀️";
const hav=(a:number,b:number,c:number,d:number)=>{const R=6371,r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,z=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(z))};
const match=(p:Destination,q:string)=>{q=q.trim().toLowerCase();const n=p.name.toLowerCase(),r=(p.region||"").toLowerCase(),c=p.country.toLowerCase();if(n===q)return 100000;if(n.startsWith(q))return 80000+(p.population||0)/10000;if(n.includes(q))return 50000+(p.population||0)/10000;if(r.startsWith(q))return 25000;if(c.startsWith(q))return 15000;if(r.includes(q)||c.includes(q))return 5000;return-1};
const outlook=(s:number,r:number)=>s>=88&&r<10?["Excellent time to go","Strong outdoor conditions are expected."]:s>=75&&r>=20?["Rainy but scenic","Showers are likely, but the destination can still be rewarding."]:s>=72?["Good time to visit","Conditions look favourable overall."]:s>=55?["Mixed conditions","Keep your plans flexible."]:["Consider another date","Weather may limit outdoor sightseeing."];
const category=(p:Destination)=>{
 const t=(p.name+" "+(p.attractions||[]).join(" ")+" "+(p.category||"")).toLowerCase();
 if(/tiger|safari|wildlife|sanctuary|national park|bird|reserve/.test(t))return "Wildlife";
 if(/trek|rafting|paragliding|adventure|ski|diving|surf|climb/.test(t))return "Adventure";
 if(/temple|church|mosque|monastery|pilgrim|jyotirling|dham|religious|spiritual/.test(t))return "Religious";
 if(/fort|palace|heritage|museum|ruins|historic|archaeolog|monument/.test(t))return "Heritage";
 if(/beach|coast|island|seaside|goa|gokarna|maldives/.test(t))return "Beach";
 if(/mountain|hill|peak|ghat|himalaya|chik|coorg|munnar|wayanad|ooty|manali|shimla/.test(t))return "Mountains";
 if(/falls|nature|forest|lake|valley|garden|scenic/.test(t))return "Nature";
 return "City break";
};
const vidCat=(v:Video)=>/road|traffic|drive|route|condition/i.test(v.title)?"Road conditions":/rain|weather|snow|fog|monsoon|storm/i.test(v.title)?"Weather":/vlog|trip|travel|tour|visit/i.test(v.title)?"Travel vlogs":"Recent";
const imageApi=(p:string)=>`/api/image?place=${encodeURIComponent(p)}`;
const minTripDistance=(radius:number)=>radius<=100?Math.round(radius*.6):radius<=300?Math.round(radius*.67):radius<=500?Math.round(radius*.6):Math.round(radius*.5);
const distanceFit=(distance:number,min:number,max:number)=>{
  const ideal=min+(max-min)*.72;
  const span=Math.max(max-min,1);
  return Math.max(0,100-Math.abs(distance-ideal)/span*100);
};
const weatherLabel=(score:number,rain:number)=>score>=88&&rain<15?"Excellent weather":score>=78?"Good weather":score>=65?"Mixed weather":"Weather caution";
const tourismScore=(p:Destination)=>{
 const famous:Record<string,number>={
  "hampi":98,"goa":98,"agra":97,"jaipur":97,"udaipur":96,"varanasi":96,"leh":97,"ladakh":98,
  "manali":95,"munnar":95,"coorg":95,"chikmagalur":94,"rishikesh":94,"darjeeling":94,
  "srinagar":96,"gokarna":92,"wayanad":93,"mysuru":91,"mysore":91,"jaisalmer":94,
  "amritsar":94,"ooty":93,"kodaikanal":93,"shillong":93,"gangtok":94,"puri":94,
  "puducherry":92,"pondicherry":92,"alappuzha":94,"alleppey":94,"thekkady":91,
  "nainital":92,"mussoorie":92,"rameswaram":93,"tirupati":94,"khajuraho":92
 };
 const key=p.name.toLowerCase().trim();
 if(famous[key])return famous[key];
 const pop=Math.max(p.population||1000,1000);
 const cat=category(p);
 const catBoost=["Mountains","Beach","Wildlife","Adventure"].includes(cat)?18:["Nature","Heritage","Religious"].includes(cat)?16:8;
 return Math.round(Math.min(90,24+Math.log10(pop)*8+catBoost));
};
const styleScore=(p:Destination,style:string)=>{
 if(style==="Any")return 100;
 const c=category(p);
 if(c===style)return 100;
 const related:Record<string,string[]>={
  "Nature":["Mountains","Wildlife","Adventure"],
  "Mountains":["Nature","Adventure","Wildlife"],
  "Wildlife":["Nature","Adventure"],
  "Adventure":["Mountains","Nature","Wildlife","Beach"],
  "Heritage":["Religious","City break"],
  "Religious":["Heritage","City break"],
  "Beach":["Adventure","Nature"],
  "City break":["Heritage","Religious"],
  "Family":["City break","Nature","Beach","Heritage"],
  "Romantic":["Mountains","Nature","Beach"]
 };
 return (related[style]||[]).includes(c)?70:30;
};
const weatherSuitability=(f:Day[],style:string,pref:string)=>{if(!f.length)return 50;const rain=f.reduce((a,d)=>a+d.rain,0)/f.length,temp=f.reduce((a,d)=>a+d.max,0)/f.length,storms=f.filter(d=>[95,96,99].includes(d.code)).length;let x=90-Math.min(rain*2.4,45)-storms*18-Math.max(0,temp-34)*3;if(style==="Beach")x=100-Math.min(rain*4,65)-storms*22;if(["Nature","Mountains","Wildlife","Adventure"].includes(style)){x=92-Math.max(0,rain-8)*2.2-storms*20;if(rain>=1&&rain<=8)x+=6}if(["Heritage","Religious","City break"].includes(style))x=96-Math.min(rain*3,50)-storms*20-Math.max(0,temp-31)*4;if(pref==="Sunny"&&rain<2)x+=8;if(pref==="Cool"&&temp<=27)x+=8;if(pref==="Rainy / Monsoon"&&rain>=1&&rain<=10)x+=10;return Math.max(0,Math.min(100,Math.round(x)))};
const practicalScore=(km:number,d:number,m:string,max:number)=>{const daily=m==="Bike"?180:m==="Train"?500:m==="Flight"?1500:280,lim=Math.min(max,daily*Math.max(1,d));return km>lim?Math.max(15,100-(km-lim)/Math.max(lim,1)*100):Math.max(55,100-km/Math.max(lim,1)*35)};
const confidenceLabel=(d:number)=>d<=3?"High forecast confidence":d<=7?"Moderate forecast confidence":"Long-range forecast";
const makeReason=(p:Destination,w:number,t:number,best:string,style:string)=>w>=85&&t>=85?`Strong ${category(p).toLowerCase()} destination with excellent upcoming conditions. ${best} currently looks best.`:w>=80?`Good upcoming weather and solid tourism value make this a strong ${style==="Any"?"trip":style.toLowerCase()+" trip"} option.`:t>=90?"A major tourism destination with acceptable upcoming weather.":"Balanced choice for tourism value, weather and travel practicality.";

function SmartImage({place,className=""}:{place:string;className?:string}) {
  const [src,setSrc]=useState("");
  useEffect(()=>{let ok=true;fetch(imageApi(place)).then(r=>r.json()).then(x=>{if(ok)setSrc(x.image||"")}).catch(()=>{});return()=>{ok=false}},[place]);
  return src?<img className={className} src={src} alt={place}/>:<div className={`imageFallback ${className}`}>✦</div>;
}


function travelModeFor(distance:number, requested:string){
  if(requested!=="Any") return requested;
  if(distance<=180) return "Car";
  if(distance<=550) return "Train";
  return "Flight";
}
function estimatedTravelHours(distance:number, mode:string){
  if(mode==="Car") return Math.max(.5,distance/55);
  if(mode==="Train") return Math.max(1,distance/75 + .75);
  if(mode==="Flight") return Math.max(2,distance/700 + 2.25); // airport + flight + transfer estimate
  return Math.max(.5,distance/55);
}
function idealTravelHours(days:number){
  if(days<=1) return 2;
  if(days===2) return 3;
  if(days===3) return 4.5;
  if(days<=5) return 6;
  if(days<=7) return 8;
  return 10;
}
function practicalityScore(distance:number, requestedMode:string, maxHours:number, days:number){
  const mode=travelModeFor(distance,requestedMode);
  const hours=estimatedTravelHours(distance,mode);
  const ideal=idealTravelHours(days);
  if(hours>maxHours) return {score:Math.max(0,Math.round(55-(hours-maxHours)*18)),mode,hours};
  const penalty=Math.max(0,hours-ideal)*9;
  return {score:Math.max(35,Math.round(100-penalty)),mode,hours};
}
function transportIcon(mode:string){return mode==="Flight"?"✈️":mode==="Train"?"🚆":"🚗";}

export default function Home(){
 const [travelWhen,setTravelWhen]=useState("This weekend");
 const [customStart,setCustomStart]=useState("");
 const [customEnd,setCustomEnd]=useState("");
 const [popularity,setPopularity]=useState("Balanced");
 const [pace,setPace]=useState("Balanced");

 const[all,setAll]=useState<Destination[]>([]),[data,setData]=useState<DRes|null>(null),[latest,setLatest]=useState<Video[]>([]),[popular,setPopular]=useState<Video[]>([]);
 const[query,setQuery]=useState(""),[open,setOpen]=useState(false),[active,setActive]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const[tab,setTab]=useState("Recent"),[video,setVideo]=useState<Video|null>(null),[history,setHistory]=useState(false),[saved,setSaved]=useState<string[]>([]),[compare,setCompare]=useState<CompareItem[]>([]);
 const[plannerOpen,setPlannerOpen]=useState(false),[transport,setTransport]=useState("Any"),[maxTravelHours,setMaxTravelHours]=useState(5),[originQ,setOriginQ]=useState(""),[origin,setOrigin]=useState<Destination|null>(null),[radius,setRadius]=useState(300),[days,setDays]=useState(3),[tripType,setTripType]=useState("Any"),[discovering,setDiscovering]=useState(false),[results,setResults]=useState<Discovery[]>([]);
 const tripDays = days;
 const[travellingWith,setTravellingWith]=useState("Any"),[travelMode,setTravelMode]=useState("Car"),[preferredWeather,setPreferredWeather]=useState("Any"),[avoid,setAvoid]=useState("Heavy rain"),[strictRadius,setStrictRadius]=useState(false),[advancedOpen,setAdvancedOpen]=useState(false);
 const[nearby,setNearby]=useState<Discovery[]>([]),[nearbyLoading,setNearbyLoading]=useState(false);
 const[bestFilter,setBestFilter]=useState("All"),[scoreOpen,setScoreOpen]=useState(false),[showAllBest,setShowAllBest]=useState(false);
 const[forecastRange,setForecastRange]=useState<7|15>(7),[selectedForecastDay,setSelectedForecastDay]=useState<Day|null>(null);
 const bestMatchesRef=useRef<HTMLDivElement|null>(null);
 const searchRef=useRef<HTMLDivElement>(null);

 useEffect(()=>{fetch("/data/destinations.json").then(r=>r.json()).then((x:Destination[])=>setAll(x)).catch(()=>setError("Destination catalogue could not be loaded.")).finally(()=>setLoading(false));try{setSaved(JSON.parse(localStorage.getItem("wg-saved")||"[]"));setCompare(JSON.parse(localStorage.getItem("wg-compare")||"[]"))}catch{}},[]);
 useEffect(()=>{const f=(e:MouseEvent)=>{if(searchRef.current&&!searchRef.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",f);return()=>document.removeEventListener("mousedown",f)},[]);
 const suggestions=useMemo(()=>query.trim()?all.map(p=>({p,s:match(p,query)})).filter(x=>x.s>=0).sort((a,b)=>b.s-a.s).slice(0,8).map(x=>x.p):[],[all,query]);
 const originSuggestions=useMemo(()=>originQ.trim()?all.map(p=>({p,s:match(p,originQ)})).filter(x=>x.s>=0).sort((a,b)=>b.s-a.s).slice(0,6).map(x=>x.p):[],[all,originQ]);
 const future=data?.weather.days.slice(7)||[],past=data?.weather.days.slice(0,7)||[],history30=data?.weather.history30||past,visibleForecast=future.slice(0,forecastRange===7?7:15),rain=visibleForecast.reduce((a,d)=>a+d.rain,0),best=visibleForecast.slice().sort((a,b)=>(a.rain-b.rain)||(Math.abs(a.max-26)-Math.abs(b.max-26)))[0];
 const monthRain=Math.round(history30.reduce((a,d)=>a+d.rain,0)),monthWetDays=history30.filter(d=>d.rain>=1).length,monthAvgHigh=history30.length?Math.round(history30.reduce((a,d)=>a+d.max,0)/history30.length):0,recent7Rain=Math.round(past.reduce((a,d)=>a+d.rain,0));
 const monthlyRainRate=history30.length?monthRain/history30.length:0,nextRainRate=future.length?rain/future.length:0,weatherTrend=nextRainRate>monthlyRainRate*1.25?"Wetter than last month":nextRainRate<monthlyRainRate*.75?"Drier than last month":"Similar to last month",predictorConfidence=history30.length>=25?"High":history30.length>=14?"Medium":"Limited";
 const[headline,explain]=outlook(data?.decisionScore||0,rain);
 useEffect(()=>{if(!data?.destination)return;let active=true;setNearbyLoading(true);rankTripsFrom(data.destination,500,10).then(x=>{if(active)setNearby(x)}).finally(()=>{if(active)setNearbyLoading(false)});return()=>{active=false}},[data?.destination.slug]);
 const filteredNearby=useMemo(()=>bestFilter==="All"?nearby:nearby.filter(r=>category(r.destination).toLowerCase().includes(bestFilter.toLowerCase())),[nearby,bestFilter]);
 const visibleNearby=(showAllBest?filteredNearby:filteredNearby.slice(0,6));
 const alerts=useMemo(()=>future.flatMap(d=>{const a:string[]=[];if([95,96,99].includes(d.code))a.push(`Thunderstorm risk on ${new Date(d.date).toLocaleDateString("en",{weekday:"long"})}`);if(d.rain>=35)a.push(`Heavy rain possible on ${new Date(d.date).toLocaleDateString("en",{weekday:"long"})}`);if(d.max>=38)a.push(`Extreme heat possible on ${new Date(d.date).toLocaleDateString("en",{weekday:"long"})}`);return a}).slice(0,3),[future]);
 const filteredVideos=useMemo(()=>{let v=tab==="Most viewed"?popular:latest;if(["Weather","Road conditions","Travel vlogs"].includes(tab))v=latest.filter(x=>vidCat(x)===tab);return v.filter(x=>x.title.length>8).slice(0,10)},[tab,latest,popular]);

 async function load(p:Destination){
  setLoading(true);setOpen(false);setQuery("");setError("");
  try{const[dr,vr]=await Promise.all([fetch(`/api/destination?slug=${encodeURIComponent(p.slug)}`).then(r=>r.json()),fetch(`/api/videos?place=${encodeURIComponent(p.name)}`).then(r=>r.json())]);if(dr.error)throw Error(dr.error);setData(dr);setLatest(vr.latest||[]);setPopular(vr.mostViewed||[]);if(vr.error)setError(vr.error);try{const old:string[]=JSON.parse(localStorage.getItem("wg-recent")||"[]");localStorage.setItem("wg-recent",JSON.stringify([p.slug,...old.filter(x=>x!==p.slug)].slice(0,8)))}catch{}}catch(e){setError(e instanceof Error?e.message:"Unable to load destination")}finally{setLoading(false)}
 }
 useEffect(()=>{if(all.length&&!data){const p=all.find(x=>x.slug==="chikmagalur")||all.find(x=>/chikmagalur/i.test(x.name))||all[0];if(p)load(p)}},[all.length]); // eslint-disable-line
 function toggleSave(){if(!data)return;const n=saved.includes(data.destination.slug)?saved.filter(x=>x!==data.destination.slug):[...saved,data.destination.slug];setSaved(n);localStorage.setItem("wg-saved",JSON.stringify(n))}
 function addCompare(){if(!data)return;const item:CompareItem={destination:data.destination,score:data.decisionScore,rain:Math.round(rain),best:best?new Date(best.date).toLocaleDateString("en",{weekday:"short"}):"—",videos:latest.length};const n=[...compare.filter(x=>x.destination.slug!==item.destination.slug),item].slice(-3);setCompare(n);localStorage.setItem("wg-compare",JSON.stringify(n))}

 async function rankTripsFrom(start:Destination,maxRadius=500,limit=10){
  const pool=all.filter(p=>p.slug!==start.slug).map(p=>({p,d:hav(start.lat,start.lon,p.lat,p.lon)})).filter(x=>x.d>=60&&x.d<=maxRadius).sort((a,b)=>tourismScore(b.p)-tourismScore(a.p)||(b.p.population||0)-(a.p.population||0)).slice(0,24);
  const out:Discovery[]=[];
  for(const x of pool){try{const r=await fetch(`/api/destination?slug=${encodeURIComponent(x.p.slug)}`).then(z=>z.json());if(r.error)continue;const f:Day[]=r.weather.days.slice(7,14),rain=f.reduce((n:number,d:Day)=>n+d.rain,0),bd=f.slice().sort((u:Day,v:Day)=>(u.rain-v.rain)||(Math.abs(u.max-26)-Math.abs(v.max-26)))[0],best=bd?new Date(bd.date).toLocaleDateString("en",{weekday:"short"}):"—",tourism=tourismScore(x.p),weather=weatherSuitability(f,"Any","Any"),practical=practicalScore(x.d,3,"Car",maxRadius),rankScore=Math.round(tourism*.45+weather*.45+practical*.10);out.push({destination:x.p,score:weather,distance:Math.round(x.d),rain:Math.round(rain),best,rankScore,tourism,reason:makeReason(x.p,weather,tourism,best,"Any")})}catch{}}
  return out.sort((u,v)=>(v.rankScore||0)-(u.rankScore||0)||(v.tourism||0)-(u.tourism||0)).slice(0,limit);
 }
 async function discover(){
  if(!origin)return setError("Choose a starting city from the suggestions first.");
  setDiscovering(true);setResults([]);setError("");
  const preferredMin=minTripDistance(radius),outer=strictRadius?radius:Math.round(radius*1.08),min=Math.max(20,Math.round(preferredMin*(days<=1?.55:days<=2?.75:1)));
  let pool=all.filter(p=>p.slug!==origin.slug).map(p=>({p,d:hav(origin.lat,origin.lon,p.lat,p.lon)})).filter(x=>x.d>=min&&x.d<=outer).sort((a,b)=>tourismScore(b.p)-tourismScore(a.p)||(b.p.population||0)-(a.p.population||0));
  if(pool.length<8){const relaxed=Math.max(20,Math.round(min*.65));pool=all.filter(p=>p.slug!==origin.slug).map(p=>({p,d:hav(origin.lat,origin.lon,p.lat,p.lon)})).filter(x=>x.d>=relaxed&&x.d<=outer).sort((a,b)=>tourismScore(b.p)-tourismScore(a.p))}
  const scored:Array<Discovery&{rankScore:number}>=[];
  for(const x of pool.slice(0,24)){try{const r=await fetch(`/api/destination?slug=${encodeURIComponent(x.p.slug)}`).then(z=>z.json());if(r.error)continue;const f:Day[]=r.weather.days.slice(7,14),rr=f.reduce((a:number,d:Day)=>a+d.rain,0),bd=f.slice().sort((a:Day,b:Day)=>(a.rain-b.rain)||(Math.abs(a.max-26)-Math.abs(b.max-26)))[0],best=bd?new Date(bd.date).toLocaleDateString("en",{weekday:"long"}):"—";const tourism=tourismScore(x.p),weather=weatherSuitability(f,tripType,preferredWeather),style=styleScore(x.p,tripType),practical=practicalScore(x.d,days,travelMode,radius),storm=f.filter(d=>[95,96,99].includes(d.code)).length,heat=f.some(d=>d.max>=40);if((avoid==="Heavy rain"&&rr>=80)||(avoid==="Extreme heat"&&heat)||storm>=3)continue;const rankScore=Math.round(tourism*.40+weather*.40+style*.10+practical*.10),warning=rr>=50?`Heavy rain risk: ${Math.round(rr)} mm forecast`:storm?`Thunderstorm risk on ${storm} day${storm>1?"s":""}`:heat?"Extreme heat possible":"";scored.push({destination:x.p,score:weather,distance:Math.round(x.d),rain:Math.round(rr),best,rankScore,tourism,distanceFit:Math.round(distanceFit(x.d,min,outer)),styleFit:style,confidence:confidenceLabel(days),warning,reason:makeReason(x.p,weather,tourism,best,tripType)})}catch{}}
  const ranked=scored.sort((a,b)=>b.rankScore-a.rankScore||(b.tourism||0)-(a.tourism||0)).slice(0,10);
  await Promise.all(ranked.slice(0,3).map(async r=>{try{const x=await fetch(`/api/image?place=${encodeURIComponent(r.destination.name)}`).then(z=>z.json());r.image=x.image||x.url||""}catch{}try{const x=await fetch(`/api/videos?place=${encodeURIComponent(r.destination.name)}`).then(z=>z.json()),a=x.latest||x.recent||x.videos||[];r.videoCount=Array.isArray(a)?a.length:0}catch{r.videoCount=0}}));
  setResults([...ranked]);setDiscovering(false);setTimeout(()=>bestMatchesRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),80);
 }
 const mapUrl=data?`https://www.openstreetmap.org/export/embed.html?bbox=${data.destination.lon-0.35}%2C${data.destination.lat-0.25}%2C${data.destination.lon+0.35}%2C${data.destination.lat+0.25}&layer=mapnik&marker=${data.destination.lat}%2C${data.destination.lon}`:"";

 return <main>
  {loading&&<div className="loading"><div className="spinner"/><b>Building your travel decision…</b><small>Forecast + videos + destination intelligence</small></div>}
  <header><div className="brand"><span>✦</span><div><b>WanderGuide</b><small>Travel decision engine</small></div></div><nav><a href="#discover">Discover</a><a href="#weather">Weather</a><a href="#map">Map</a><a href="#evidence">Videos</a></nav><button className="plannerBtn" onClick={()=>setPlannerOpen(true)}>✦ Where can I go?</button></header>

  <section className="searchHero" id="discover"><small>DON'T JUST SEARCH. DECIDE.</small><h1>Where should you travel next?</h1><p>Search the world or tell WanderGuide how much time you have. We combine weather, distance and fresh video evidence.</p>
   <div className="globalSearch" ref={searchRef}><span>⌕</span><input value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0)}} onKeyDown={e=>{if(e.key==="ArrowDown"){e.preventDefault();setActive(Math.min(active+1,suggestions.length-1))}if(e.key==="ArrowUp"){e.preventDefault();setActive(Math.max(active-1,0))}if(e.key==="Enter"&&suggestions[active])load(suggestions[active]);if(e.key==="Escape")setOpen(false)}} placeholder="Search any city or destination worldwide…" autoComplete="off"/>
    {open&&<div className="suggestions">{query.trim()?<>{suggestions.map((p,i)=><button className={i===active?"active":""} key={p.id} onClick={()=>load(p)}><i>📍</i><div><b>{p.name}</b><small>{p.region?`${p.region}, `:""}{p.country}</small></div><em>›</em></button>)}{!suggestions.length&&<p>No matching destination in the catalogue.</p>}</>:<><button onClick={()=>setPlannerOpen(true)}><i>✦</i><div><b>Where can I go?</b><small>Discover by time, distance and trip style</small></div><em>›</em></button><p className="hint">Start typing a city, region or country.</p></>}</div>}
   </div>
   <div className="heroActions"><button onClick={()=>setPlannerOpen(true)}>✦ Find my best trip</button><span>or search a destination above</span></div>
  </section>

  {alerts.length>0&&<section className="alerts"><b>⚠ Travel weather alert</b><div>{alerts.map(a=><span key={a}>{a}</span>)}</div></section>}

  {data&&<section className="decisionExperience">
   <div className="bestNow">
    <div className="sectionTitleRow"><div><small>WHERE SHOULD YOU GO RIGHT NOW?</small><h2>Best places this week</h2><p>Ranked primarily by destination quality and upcoming weather.</p></div><span className="regionPill">{data.destination.region||data.destination.country}</span></div>
    <div className="rankingFormula smartSummary"><b>How we’ll rank your trip</b><span>We prioritise great destinations with suitable weather that are practical for your trip length and transport.</span><button type="button" onClick={()=>setScoreOpen(v=>!v)}>How ranking works</button></div><div className="bestFilters">{["All","Mountains","Beach","Nature","Heritage"].map(x=><button key={x} className={bestFilter===x?"active":""} onClick={()=>setBestFilter(x)}>{x}</button>)}</div>
    {nearbyLoading?<div className="bestLoader"><span/><b>Ranking destinations for this week…</b></div>:visibleNearby.length?<div className="bestGrid">{visibleNearby.map((r,i)=><button className={"bestCard "+(i<3?"podium":"")} key={r.destination.id} onClick={()=>load(r.destination)}><div className="bestRank">{i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}</div><div className="bestBody"><div className="bestName">{r.destination.name}</div><div className="bestMeta">{category(r.destination)} · {r.distance} km · {transportIcon(r.travelMode||travelModeFor(r.distance,transport))} {(r.travelHours||estimatedTravelHours(r.distance,r.travelMode||travelModeFor(r.distance,transport))).toFixed(1)}h est.</div><div className="bestSignals"><span>☀ {r.score} weather</span><span>⭐ {r.tourism} tourism</span><span>🌧 {r.rain} mm</span><span>🧭 {r.practicality??practicalityScore(r.distance,transport,maxTravelHours,tripDays).score} practical</span></div><div className="bestVerdict">{r.score>=88?"Excellent weather":r.score>=78?"Good this week":"Worth considering"}</div></div><div className="bestScore">{r.rankScore}<small>TRIP</small></div></button>)}</div>:<div className="emptyBest">No strong matches for this filter.</div>}
    {filteredNearby.length>6&&<button className="viewAllBest" onClick={()=>setShowAllBest(v=>!v)}>{showAllBest?"Show fewer":"View all 10 alternatives"} →</button>}
   </div>
   <div className="goDecision">
    <div className="decisionTop"><div><small>SHOULD YOU GO?</small><div className="destinationLine"><h2>{data.destination.name}</h2><span>{data.destination.region}, {data.destination.country}</span></div></div><div className="wanderScore"><b>{data.decisionScore}</b><span>/100</span><small>WANDERSCORE</small></div></div>
    <div className={"actionVerdict "+(data.decisionScore>=85?"great":data.decisionScore>=70?"good":"poor")}><strong>{data.decisionScore>=85?"☀️ Great time to visit":data.decisionScore>=70?"🌦️ Good if the conditions suit your trip":"⚠️ Consider another destination"}</strong><p>{best?`${new Date(best.date).toLocaleDateString("en",{weekday:"long"})} currently looks best. `:""}{headline==="Rainy but scenic"?"Expect wet conditions, greenery and possible fog, with some better sightseeing windows.":headline==="Excellent time to go"?"The upcoming forecast is favourable for sightseeing and outdoor plans.":`The coming week is ${weatherTrend.toLowerCase()} compared with the recent month.`}</p></div>
    <div className="scoreSummary"><div><small>WEATHER</small><b>{Math.round(weatherSuitability(future,"Any","Any"))}</b></div><div><small>TOURISM</small><b>{tourismScore(data.destination)}</b></div><div><small>BEST DAY</small><b>{best?new Date(best.date).toLocaleDateString("en",{weekday:"short"}):"—"}</b></div><div><small>CONFIDENCE</small><b>{predictorConfidence}</b></div><button onClick={()=>setScoreOpen(v=>!v)}>{scoreOpen?"Hide details":"Why this score?"}</button></div>
    {scoreOpen&&<div className="scoreExplain"><b>How WanderGuide reached this decision</b><p>Weather and destination quality carry most of the recommendation. Recent conditions show whether the forecast is an improvement or continuation.</p><div><span>Next 7-day rain <b>{Math.round(rain)} mm</b></span><span>Last 30-day rain <b>{monthRain} mm</b></span><span>Wet days last month <b>{monthWetDays}</b></span><span>Fresh videos <b>{latest.length}</b></span></div></div>}
    <div className="dayStrip">{future.map(d=>{const ds=Math.max(0,Math.min(100,100-Math.min(d.rain*5,45)-([65,80,81,82,95,96,99].includes(d.code)?15:0))),isBest=best?.date===d.date;return <div className={isBest?"bestDay":""} key={d.date}><small>{new Date(d.date).toLocaleDateString("en",{weekday:"short"})}</small><i>{wx(d.code)}</i><b>{Math.round(ds)}</b><span>{d.rain}mm</span>{isBest&&<em>BEST</em>}</div>})}</div>
    <div className="evidenceGrid"><div className="trendCard"><div className="cardEyebrow">WEATHER STORY</div><h3>{weatherTrend}</h3><div className="rainBars"><div><span>Past 30d</span><i style={{width:`${Math.min(100,monthRain/2.5)}%`}}/><b>{monthRain}mm</b></div><div><span>Past 7d</span><i style={{width:`${Math.min(100,recent7Rain*1.8)}%`}}/><b>{recent7Rain}mm</b></div><div><span>Next 7d</span><i style={{width:`${Math.min(100,rain*1.8)}%`}}/><b>{Math.round(rain)}mm</b></div></div><p>{weatherTrend==="Drier than last month"?"Conditions are trending drier than the recent pattern.":weatherTrend==="Wetter than last month"?"The coming week is trending wetter than the recent pattern.":"The coming week broadly continues the recent weather pattern."}</p></div><div className="videoEvidence"><div className="cardEyebrow">REAL-WORLD EVIDENCE</div><h3>{latest.length} recent traveller videos</h3><div className="evidenceStats"><span>🎥 Fresh footage <b>{latest.length}</b></span><span>📈 Most viewed <b>{top.length}</b></span><span>🗓 Confidence <b>{predictorConfidence}</b></span></div><p>Use recent footage to verify scenery, visibility and general conditions before making the final decision.</p><button onClick={()=>document.getElementById("evidence")?.scrollIntoView({behavior:"smooth"})}>Watch recent conditions ↓</button></div></div>
    <div className="decisionActions"><button onClick={toggleSave}>{saved.includes(data.destination.slug)?"♥ Saved":"♡ Save"}</button><button onClick={addCompare}>⇄ Add to compare</button><button className="primary" onClick={()=>setPlannerOpen(true)}>Find alternatives</button></div>
   </div>
  </section>}

  {compare.length>1&&<section className="compare"><div className="sectionTitle"><div><small>COMPARE</small><h2>Which destination wins?</h2></div><button onClick={()=>{setCompare([]);localStorage.removeItem("wg-compare")}}>Clear</button></div>
   <div className="compareTable"><div className="row labels"><b>Destination</b>{compare.map(x=><strong key={x.destination.slug}>{x.destination.name}</strong>)}</div><div className="row"><b>WanderScore</b>{compare.map(x=><span key={x.destination.slug}>{x.score}</span>)}</div><div className="row"><b>7-day rain</b>{compare.map(x=><span key={x.destination.slug}>{x.rain} mm</span>)}</div><div className="row"><b>Best day</b>{compare.map(x=><span key={x.destination.slug}>{x.best}</span>)}</div><div className="row"><b>Recent videos</b>{compare.map(x=><span key={x.destination.slug}>{x.videos}</span>)}</div></div>
   <p className="winner">🏆 {compare.slice().sort((a,b)=>b.score-a.score)[0]?.destination.name} currently has the strongest WanderGuide score.</p>
  </section>}



  <section className="weatherPlanner" id="weather">
   <div className="weatherPlannerHead">
    <div><small>PLAN AROUND THE WEATHER</small><h2>When should you go?</h2><p>Choose a time window, compare the strongest days, then tap any day for details.</p></div>
    <div className="rangeTabs" role="tablist" aria-label="Forecast range">
     {([7,15] as const).map(n=><button key={n} className={forecastRange===n?"active":""} onClick={()=>setForecastRange(n)}>Next {n} days</button>)}
    </div>
   </div>

   <div className="weatherRecommendation">
    <div className="recommendIcon">{best?wx(best.code):"☀️"}</div>
    <div><small>BEST WINDOW</small><b>{best?new Date(best.date).toLocaleDateString("en",{weekday:"long",day:"numeric",month:"short"}):"—"}</b><span>{best?`${best.max}°C high · ${best.rain} mm rain expected`:"Forecast unavailable"}</span></div>
    <div className="recommendScore"><strong>{best?Math.max(0,Math.min(100,100-Math.min(best.rain*5,45)-([65,80,81,82,95,96,99].includes(best.code)?15:0))):0}</strong><small>DAY SCORE</small></div>
   </div>

   <div className="forecastCards">
    {visibleForecast.map(d=>{const ds=Math.round(Math.max(0,Math.min(100,100-Math.min(d.rain*5,45)-Math.max(0,d.max-34)*2-([65,80,81,82,95,96,99].includes(d.code)?15:0)))),isBest=d.date===best?.date;return <button key={d.date} className={"forecastCard "+(isBest?"best":"")} onClick={()=>setSelectedForecastDay(d)}>
     {isBest&&<em>BEST</em>}
     <div className="fcDate"><b>{new Date(d.date).toLocaleDateString("en",{weekday:"short"})}</b><span>{new Date(d.date).toLocaleDateString("en",{day:"numeric",month:"short"})}</span></div>
     <i>{wx(d.code)}</i>
     <strong>{d.max}°</strong><small>Low {d.min}°</small>
     <div className="fcRain"><span>💧 {d.rain} mm</span><b>{ds}</b></div>
     <div className="fcHint">{ds>=85?"Excellent":ds>=72?"Good":ds>=58?"Mixed":"Poor"} for sightseeing</div>
    </button>})}
   </div>

   <div className="weatherFooter">
    <button className="historyToggleV28" onClick={()=>setHistory(!history)}>{history?"Hide":"View"} recent 30-day weather context</button>
    <span>Tap a forecast card for temperature, rain, conditions and travel guidance.</span>
   </div>
   {history&&<><div className="monthSummary"><b>{monthRain} mm rain</b><span>{monthWetDays} wet days</span><span>{monthAvgHigh}°C avg high</span><span>{weatherTrend}</span></div><div className="history">{history30.slice(-10).map(d=><div key={d.date}><b>{new Date(d.date).toLocaleDateString("en",{day:"numeric",month:"short"})}</b><i>{wx(d.code)}</i><small>{d.max}°/{d.min}° · {d.rain}mm</small></div>)}</div></>}
  </section>

  <section className="mapSection" id="map"><div className="sectionTitle"><div><small>MAP DISCOVERY</small><h2>Explore around {data?.destination.name}</h2></div><p>Use the ranked cards to inspect nearby alternatives.</p></div><div className="mapWrap">{mapUrl&&<iframe src={mapUrl} title="Destination map"/>}<div className="mapLegend"><b>{data?.destination.name}</b><span>📍 Selected destination</span><small>Map © OpenStreetMap contributors</small></div></div></section>

  <section className="evidence" id="evidence"><div className="sectionTitle"><div><small>WHAT IT LOOKS LIKE NOW</small><h2>Fresh real-world evidence</h2></div><p>Filtered to make videos more useful for a travel decision.</p></div><div className="tabs">{["Recent","Weather","Road conditions","Travel vlogs","Most viewed"].map(t=><button className={tab===t?"active":""} key={t} onClick={()=>setTab(t)}>{t}</button>)}</div>{error&&<div className="error">{error}</div>}<div className="videos">{filteredVideos.map(v=><button key={v.id} onClick={()=>setVideo(v)}><div><img src={v.thumbnail} alt=""/><i>▶</i><em>{vidCat(v)}</em></div><b>{v.title}</b><small>{v.channel} · {new Date(v.publishedAt).toLocaleDateString()}</small></button>)}</div>{!filteredVideos.length&&!error&&<div className="empty">No strong matches in this video category.</div>}</section>

  <section className="things"><div className="sectionTitle"><div><small>DESTINATION GUIDE</small><h2>Top things to see in {data?.destination.name}</h2></div></div><div className="thingsGrid">{(data?.destination.attractions||["Scenic viewpoints","Nature experiences","Local landmarks","Local markets"]).slice(0,8).map((a,i)=><article key={a}><SmartImage place={`${a} ${data?.destination.name}`}/><div><span>{String(i+1).padStart(2,"0")}</span><b>{a}</b></div></article>)}</div></section>

  {selectedForecastDay&&<div className="modal forecastModal" onClick={()=>setSelectedForecastDay(null)}><div className="forecastDialog" onClick={e=>e.stopPropagation()}>
   <button className="close" onClick={()=>setSelectedForecastDay(null)}>×</button>
   <div className="fdTop"><div><small>DAILY TRAVEL OUTLOOK</small><h2>{new Date(selectedForecastDay.date).toLocaleDateString("en",{weekday:"long",day:"numeric",month:"long"})}</h2><p>{data?.destination.name}</p></div><i>{wx(selectedForecastDay.code)}</i></div>
   {(()=>{const d=selectedForecastDay,ds=Math.round(Math.max(0,Math.min(100,100-Math.min(d.rain*5,45)-Math.max(0,d.max-34)*2-([65,80,81,82,95,96,99].includes(d.code)?15:0))));return <><div className={"fdVerdict "+(ds>=85?"excellent":ds>=72?"good":ds>=58?"mixed":"poor")}><strong>{ds>=85?"Excellent day to go":ds>=72?"Good day to go":ds>=58?"Possible, but check conditions":"Consider another day"}</strong><span>{ds>=85?"Conditions look favourable for sightseeing and outdoor plans.":ds>=72?"Mostly workable conditions with some weather considerations.":ds>=58?"Weather may interrupt some outdoor plans.":"Weather conditions may make outdoor sightseeing less comfortable."}</span><b>{ds}<small>/100</small></b></div>
   <div className="fdMetrics"><div><small>HIGH</small><b>{d.max}°C</b></div><div><small>LOW</small><b>{d.min}°C</b></div><div><small>RAIN</small><b>{d.rain} mm</b></div><div><small>CONDITION</small><b>{[0,1].includes(d.code)?"Clear":[2,3].includes(d.code)?"Cloudy":[45,48].includes(d.code)?"Foggy":[51,53,55,61,63,65,80,81,82].includes(d.code)?"Rainy":[95,96,99].includes(d.code)?"Thunderstorm":"Variable"}</b></div></div>
   <div className="fdAdvice"><h3>What this means for your trip</h3><p>{d.rain>=15?"Plan indoor alternatives and allow extra travel time. Heavy rain can affect visibility and outdoor attractions.":d.rain>=5?"Carry rain protection and keep the itinerary flexible. Short outdoor visits should still be possible.":d.max>=34?"Rain risk is low, but the afternoon may be hot. Prefer morning and late-afternoon sightseeing.":"This is one of the more comfortable days in the current forecast window for outdoor sightseeing."}</p></div></>})()}
   <button className="fdDone" onClick={()=>setSelectedForecastDay(null)}>Done</button>
  </div></div>}

  {plannerOpen&&<div className="modal plannerModal" onClick={()=>setPlannerOpen(false)}><div className="planner" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setPlannerOpen(false)}>×</button><small>WANDERGUIDE DISCOVERY</small><h2>Where can I go?</h2><p>Tell us when and how you want to travel. WanderGuide finds destinations worth the journey using destination quality, weather and travel practicality.</p>
   <label>Travelling from<div className="originSearch"><input value={originQ} onChange={e=>{setOriginQ(e.target.value);setOrigin(null)}} placeholder="e.g. Bengaluru"/>{originQ&&!origin&&<div>{originSuggestions.map(p=><button key={p.id} onClick={()=>{setOrigin(p);setOriginQ(`${p.name}, ${p.region}`)}}><b>{p.name}</b><small>{p.region}, {p.country}</small></button>)}</div>}</div></label>
   <div className="plannerGrid"><label>When do you want to go?<select value={travelWhen} onChange={e=>setTravelWhen(e.target.value)}><option>This weekend</option><option>Next weekend</option><option>Next 7 days</option><option>Choose dates</option></select></label>
{travelWhen==="Choose dates"&&<div className="dateRange"><label>From<input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}/></label><label>To<input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}/></label></div>}<label>Trip length<select value={days} onChange={e=>setDays(+e.target.value)}><option value={1}>1 day</option><option value={2}>2 days</option><option value={3}>3 days</option><option value={4}>4 days</option><option value={5}>5 days</option><option value={7}>7 days</option><option value={10}>10 days</option></select></label><label>Trip style<select value={tripType} onChange={e=>setTripType(e.target.value)}><option>Any</option><option>Nature</option><option>Mountains</option><option>Beach</option><option>Heritage</option><option>Wildlife</option><option>Religious</option><option>Adventure</option><option>City break</option><option>Family</option><option>Romantic</option></select></label>
<label>Transport<select value={transport} onChange={e=>setTransport(e.target.value)}><option>Any</option><option>Car</option><option>Train</option><option>Flight</option></select></label>
<label>Maximum travel time<select value={maxTravelHours} onChange={e=>setMaxTravelHours(Number(e.target.value))}><option value={2}>Up to 2 hours</option><option value={4}>Up to 4 hours</option><option value={5}>Up to 5 hours</option><option value={6}>Up to 6 hours</option><option value={8}>Up to 8 hours</option><option value={12}>Up to 12 hours</option></select></label></div>
   <button className="advancedToggle" onClick={()=>setAdvancedOpen(v=>!v)}>{advancedOpen?"Hide advanced filters":"Advanced filters"} <span>{advancedOpen?"−":"+"}</span></button>{advancedOpen&&<div className="advancedGrid">
<div className="advancedGrid">
<label>Weather preference<select value={preferredWeather} onChange={e=>setPreferredWeather(e.target.value)}><option>Any</option><option>Best weather</option><option>Sunny</option><option>Cool</option><option>Snow</option><option>Rain is OK</option></select></label>
<label>Travelling with<select value={travellingWith} onChange={e=>setTravellingWith(e.target.value)}><option>Any</option><option>Solo</option><option>Couple</option><option>Family</option><option>Friends</option><option>Kids</option></select></label>
<label>Avoid<select value={avoid} onChange={e=>setAvoid(e.target.value)}><option>Nothing</option><option>Heavy rain</option><option>Extreme heat</option><option>Very cold</option><option>Snow</option></select></label>
<label>Popularity<select value={popularity} onChange={e=>setPopularity(e.target.value)}><option>Balanced</option><option>Famous destinations</option><option>Hidden gems</option></select></label>
<label>Trip pace<select value={pace} onChange={e=>setPace(e.target.value)}><option>Relaxed</option><option>Balanced</option><option>Packed</option></select></label>
<label>Travel radius<select value={radius} onChange={e=>setRadius(+e.target.value)}><option value={100}>Up to 100 km · prefer 60–100</option><option value={300}>Up to 300 km · prefer 200–300</option><option value={500}>Up to 500 km · prefer 300–500</option><option value={800}>Up to 800 km · prefer 400–800</option><option value={1500}>Up to 1,500 km · prefer 750–1,500</option></select></label>
</div><label>Travelling with<select value={travellingWith} onChange={e=>setTravellingWith(e.target.value)}><option>Any</option><option>Solo</option><option>Couple</option><option>Family</option><option>Friends</option></select></label><label>Travel mode<select value={travelMode} onChange={e=>setTravelMode(e.target.value)}><option>Car</option><option>Bike</option><option>Train</option><option>Flight</option></select></label><label>Preferred weather<select value={preferredWeather} onChange={e=>setPreferredWeather(e.target.value)}><option>Any</option><option>Sunny</option><option>Cool</option><option>Rainy / Monsoon</option></select></label><label>Avoid<select value={avoid} onChange={e=>setAvoid(e.target.value)}><option>Heavy rain</option><option>Extreme heat</option><option>Nothing</option></select></label><label className="checkLabel"><input type="checkbox" checked={strictRadius} onChange={e=>setStrictRadius(e.target.checked)}/> Strictly within {radius} km</label></div>}<div className="radiusHint">Recommended search band: <b>{minTripDistance(radius)}–{radius} km</b>. Decision model: 40% tourism + 40% trip-specific weather + 10% style + 10% travel practicality.</div>
   <button className="discoverBtn" disabled={discovering} onClick={discover}>{discovering?"Checking destination forecasts…":`Find my best ${days}-day trip`}</button>
   {!!results.length&&<div ref={bestMatchesRef} className="discoveryResults smartResults"><div className="resultHeading"><div><h3>Best matches</h3><small>Tourism quality + trip-specific weather dominate</small></div><span>{results.length} destinations</span></div>{results[0]&&<button className="winnerCard" onClick={()=>{setPlannerOpen(false);load(results[0].destination)}}>{results[0].image?<img src={results[0].image} alt="" />:<div className="winnerImageFallback">✦</div>}<div className="winnerBody"><span className="recommendBadge">✦ WANDERGUIDE RECOMMENDS</span><h2>🥇 {results[0].destination.name}<em>{results[0].rankScore}</em></h2><p>{results[0].reason}</p><div className="winnerFacts"><span>⭐ {results[0].tourism} tourism</span><span>☀️ {results[0].score} weather</span><span>🚗 {results[0].distance} km</span><span>📅 Best {results[0].best}</span>{!!results[0].videoCount&&<span>🎥 {results[0].videoCount} recent videos</span>}</div>{results[0].warning&&<div className="tripWarning">⚠️ {results[0].warning}</div>}<small>{results[0].confidence}</small></div></button>}<div className="compactMatches">{results.slice(1).map((r,i)=><button key={r.destination.id} onClick={()=>{setPlannerOpen(false);load(r.destination)}}><strong>{i===0?"🥈":i===1?"🥉":`#${i+2}`}</strong><div><b>{r.destination.name}</b><small>{category(r.destination)} · {r.distance} km · Best {r.best}</small><span className="reason">{r.reason}</span>{r.warning&&<span className="miniWarning">⚠ {r.warning}</span>}</div><em><b>{r.rankScore}</b><small>trip score</small></em></button>)}</div>{results.length>=3&&<div className="quickCompare"><h3>Top 3 at a glance</h3><div className="compareGrid"><b></b>{results.slice(0,3).map(r=><b key={r.destination.id}>{r.destination.name}</b>)}<span>Trip score</span>{results.slice(0,3).map(r=><strong key={r.destination.id}>{r.rankScore}</strong>)}<span>Tourism</span>{results.slice(0,3).map(r=><span key={r.destination.id}>{r.tourism}</span>)}<span>Weather</span>{results.slice(0,3).map(r=><span key={r.destination.id}>{r.score}</span>)}<span>Distance</span>{results.slice(0,3).map(r=><span key={r.destination.id}>{r.distance} km</span>)}<span>Best day</span>{results.slice(0,3).map(r=><span key={r.destination.id}>{r.best}</span>)}</div></div>}</div>}
  </div></div>}

  {video&&<div className="fullscreenVideo">
   <button className="fullscreenClose" onClick={()=>setVideo(null)} aria-label="Close video">×</button>
   <iframe
    src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
    title={video.title}
    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
    allowFullScreen
   />
  </div>}
  <nav className="bottomNav"><a href="#discover">⌕<small>Discover</small></a><a href="#weather">☀<small>Weather</small></a><button onClick={()=>setPlannerOpen(true)}>✦<small>Where can I go?</small></button><a href="#map">⌖<small>Map</small></a><a href="#evidence">▶<small>Videos</small></a></nav>
 </main>
}