import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://leaf-saas-gbf8.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private/operational surfaces stay out of search results.
      disallow: ["/dashboard", "/super-admin", "/me", "/login", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
