/**
 * Centralized Brand Configuration for the Relationship Platform.
 * 
 * Provides a single, authoritative source of truth for:
 * - Product Name, Tagline, and Descriptions
 * - PWA and Application identifiers
 * - OpenGraph, Twitter, and Structured Data (JSON-LD)
 * - SEO Title formatting
 * 
 * To switch brand identity (e.g. "SoulNest" vs "SoulConnect"), 
 * either set the NEXT_PUBLIC_BRAND_NAME environment variable or
 * update the default value below.
 */

const RAW_BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "SoulNest";
const RAW_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.APP_URL?.trim() ||
  "https://soulnest.app";

export const BRAND = {
  /** Canonical display name */
  name: RAW_BRAND_NAME,

  /** Uppercase brand mark used in headers and navigation */
  mark: RAW_BRAND_NAME.toUpperCase(),

  /** Compact name for PWA launchers and mobile badges */
  shortName: process.env.NEXT_PUBLIC_BRAND_SHORT_NAME?.trim() || RAW_BRAND_NAME,

  /** Emotional product tagline */
  tagline: "Where two souls inhabit one quiet universe",

  /** Combined title suitable for root layout default */
  taglineTitle: `${RAW_BRAND_NAME} — Where two souls inhabit one quiet universe`,

  /** Primary SEO and OpenGraph narrative description */
  description:
    "A cinematic, privacy-first digital sanctuary for two. Synchronized 4K cinema, end-to-end encrypted whispers, date-locked memory vaults, and a universe built for an audience of exactly one.",

  /** Base public application URL */
  url: RAW_APP_URL,

  /** Official Twitter / X handle */
  twitterHandle: process.env.NEXT_PUBLIC_BRAND_TWITTER?.trim() || "@soulnestapp",

  /** Support and general contact email */
  supportEmail: `hello@${RAW_BRAND_NAME.toLowerCase().replace(/[^a-z0-9]/g, "")}.app`,

  /** Default author & publisher entity */
  author: RAW_BRAND_NAME,
  creator: RAW_BRAND_NAME,
  publisher: RAW_BRAND_NAME,
  parentStudio: "Ninegalaxies",

  /**
   * Helper to format consistent, accessible page title strings.
   * Format: "<Page Title> — <Brand Name>"
   */
  formatTitle: (pageTitle: string): string => `${pageTitle} — ${RAW_BRAND_NAME}`,

  /**
   * Helper to format template-based metadata titles.
   */
  titleTemplate: `%s`,
} as const;

export type BrandConfig = typeof BRAND;
