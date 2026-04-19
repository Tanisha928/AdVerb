import type { Metadata } from "next";
import { DM_Sans, Sora } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const dm = DM_Sans({ subsets: ["latin"], variable: "--font-dm", display: "swap" });

export const metadata: Metadata = {
  title: "adverb — Brand Portal",
  description: "Manage campaigns and AI creatives",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${dm.variable}`}>
      <body className="font-sans min-h-screen">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
