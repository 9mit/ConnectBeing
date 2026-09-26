import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";
import { RouteProgressBar } from "@/components/route-progress-bar";
import { Analytics } from "@vercel/analytics/next";

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

import { BRAND } from "@/lib/brand";

const siteUrl = BRAND.url;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: BRAND.taglineTitle,
    template: BRAND.titleTemplate,
  },
  description: BRAND.description,
  keywords: [
    "couples app",
    "private couple sanctuary",
    "end-to-end encrypted intimacy",
    "watch together",
    "shared couple memory vault",
    "relationship milestones",
    "private messaging for two",
  ],
  authors: [{ name: BRAND.author }],
  creator: BRAND.creator,
  publisher: BRAND.publisher,
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: BRAND.name,
    title: BRAND.taglineTitle,
    description: BRAND.description,
    images: [
      {
        url: "/souls-poster.jpg",
        width: 1280,
        height: 720,
        alt: `Two luminous souls uniting in cosmic harmony inside ${BRAND.name}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.taglineTitle,
    description: BRAND.description,
    images: ["/souls-poster.jpg"],
    creator: BRAND.twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/icons/icon.svg",
  },
};

// WCAG AA compliant: Allows user zoom (no userScalable: false or maximumScale: 1)
// viewportFit: "cover" handles iOS safe area notch & dynamic island seamlessly
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#020106" },
    { media: "(prefers-color-scheme: light)", color: "#020106" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: BRAND.name,
    url: siteUrl,
    description: BRAND.description,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "All (Web, iOS, Android, macOS, Windows, Linux)",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Pairwise End-to-End Encryption (ECDH P-256)",
      "Synchronized 4K Watch Together Theater",
      "Date-Locked Cryptographic Time Capsules",
      "Living Relationship Timeline",
      "Shared Celestial Companion",
    ],
  };

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${plusJakartaSans.variable} ${outfit.variable} antialiased bg-[#020106] text-slate-100 min-h-screen selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden`}
      >
        <Suspense fallback={null}>
          <RouteProgressBar />
        </Suspense>
        <PwaRegister />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
