import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = BRAND.url;
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/privacy", "/security"],
        disallow: [
          "/api/",
          "/dashboard/",
          "/chat/",
          "/call/",
          "/settings/",
          "/together/room/",
          "/invite/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
