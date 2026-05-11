// Public proxy for backend GET /stocks. The deploy modal in
// `app/strategies/[id]/editor-view.tsx` and the bot wizard need the PSX
// universe (symbol list + sector list) to populate their pickers, and the
// modal is a client component — calling the backend directly from the
// browser fails CORS on Vercel (Railway's `cors_origins` allowlist doesn't
// include psx-algos.vercel.app by default). Proxying through Next.js keeps
// NEXT_PUBLIC_API_BASE_URL on the server and uses same-origin fetches in
// the browser.
//
// /stocks is unauthenticated upstream, so this route forwards without a JWT
// and only passes through the `page`, `page_size`, and `active_only` query
// parameters that `lib/api/stocks.ts:getStocksPage` uses.

import { NextRequest, NextResponse } from "next/server";

const BACKEND_TIMEOUT_MS = 8_000;
// Server-side cache aligns with the backend's own 5-minute TTL on /stocks.
const REVALIDATE_S = 300;

const ALLOWED_PARAMS = new Set(["page", "page_size", "active_only"]);

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  if (!base) {
    return NextResponse.json({ error: "backend not configured" }, { status: 500 });
  }

  const upstream = new URL(`${base}/stocks`);
  for (const [k, v] of req.nextUrl.searchParams.entries()) {
    if (ALLOWED_PARAMS.has(k)) upstream.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const res = await fetch(upstream.toString(), {
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
    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
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
