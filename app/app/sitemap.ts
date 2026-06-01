import type { MetadataRoute } from "next";

// Public, unauth routes only. App routes (/strategies, /backtest, /bots,
// /signals, /portfolio, /leaderboard, /notifications) are behind NextAuth
// and redirect to login for crawlers — listing them here would just train
// search engines to follow dead ends.
const BASE = "https://psxalgos.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/brand`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
