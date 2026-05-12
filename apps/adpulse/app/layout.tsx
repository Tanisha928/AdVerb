import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono, Inter, Plus_Jakarta_Sans, Sora } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { TopNav } from "@/components/TopNav";
import "./globals.css";

const sora    = Sora({ subsets: ["latin"], variable: "--font-sora",    display: "swap" });
const dm      = DM_Sans({ subsets: ["latin"], variable: "--font-dm",   display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const inter   = Inter({ subsets: ["latin"], variable: "--font-inter",  display: "swap" });
const ibm     = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-ibm", weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "adverb — AdPulse Platform",
  description: "Brand portal, user feed, and admin dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${dm.variable} ${jakarta.variable} ${inter.variable} ${ibm.variable}`}>
      <body className="font-sans min-h-screen flex flex-col">
        <TopNav />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
