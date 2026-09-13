import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { TimezoneCookie } from "@/components/timezone-cookie";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

export const metadata: Metadata = {
  title: "Duo",
  description: "A little world for the two of you.",
  appleWebApp: { capable: true, title: "Duo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FBF8F3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <TimezoneCookie />
        <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
