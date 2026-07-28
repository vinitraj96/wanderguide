
import "./globals.css";
import type { Metadata } from "next";
export const metadata:Metadata={title:"WanderGuide — Weather + Real-World Video Travel Decisions",description:"Compare the last 7 days, next 7 days and fresh traveller videos before deciding where to go."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
