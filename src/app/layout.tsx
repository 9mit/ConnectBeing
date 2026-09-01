import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MadLove",
  description:
    "A cinematic, privacy-first space for two — intimacy, realtime connection, and a universe you build together.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#07020f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${plusJakartaSans.variable} ${outfit.variable} antialiased bg-[#07020f] text-slate-100 min-h-screen selection:bg-amber-500/30 selection:text-amber-200`}
      >
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
