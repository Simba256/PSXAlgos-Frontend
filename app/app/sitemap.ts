import type { MetadataRoute } from "next";
import { ENTRIES } from "./learn/_content";

// Public, unauth routes only. App routes (/strategies, /backtest, /bots,
// /signals, /portfolio, /leaderboard, /notifications) are behind NextAuth
// and redirect to login for crawlers — listing them here would just train
// search engines to follow dead ends.
const BASE = "https://psxalgos.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // /learn entries enumerate from the content registry — authoring a new page
  // and adding it to ENTRIES surfaces it in the sitemap automatically.
  const learn: MetadataRoute.Sitemap = ENTRIES.map((e) => ({
    url: `${BASE}/learn/${e.slug}`,
    lastModified: new Date(e.updated + "T00:00:00Z"),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/learn`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/brand`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ...learn,
  ];
}
