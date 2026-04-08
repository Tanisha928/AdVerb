import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const ibm = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-ibm", weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "AdaptAI — Admin",
  description: "Platform analytics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${ibm.variable}`}>
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
