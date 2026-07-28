import raw from "@/data/destinations.json";
export type Destination={id:string;name:string;country:string;countryCode:string;region:string;lat:number;lon:number;population?:number;slug:string;attractions?:string[]};
export const destinations=raw as Destination[];
export const findDestination=(slug:string)=>destinations.find(d=>d.slug.toLowerCase()===slug.toLowerCase());
export const places=(country:string,region:string)=>destinations.filter(d=>d.country===country&&d.region===region).sort((a,b)=>(b.population||0)-(a.population||0));
