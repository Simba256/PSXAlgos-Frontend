// Public proxy for backend GET /market/indices?period=1D — feeds the
// header KSE-100 ticker. The upstream endpoint is unauthenticated and
// rate-limited, but proxying through Next.js keeps NEXT_PUBLIC_API_BASE_URL
// the only place that knows about the backend host and lets us hold a
// short server-side cache.

import { NextResponse } from "next/server";

interface IndexRow {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  sparkline?: number[];
  period?: string;
}

const BACKEND_TIMEOUT_MS = 6_000;
const REVALIDATE_S = 60; // ticker is per-day EOD-derived, 60s is overkill-fresh

export async function GET() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  if (!base) {
    return NextResponse.json({ error: "backend not configured" }, { status: 500 });
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/market/indices?period=1D`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_S },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `upstream ${res.status}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as IndexRow[];
    return NextResponse.json(data, {
      headers: {
        // 60s edge cache, 5 min stale-while-revalidate so the chip never
        // flashes between refetches.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    );
  } finally {
    clearTimeout(t);
  }
}
