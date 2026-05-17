import { NextResponse } from "next/server";

const BACKEND_TIMEOUT_MS = 6_000;
const REVALIDATE_S = 60;

export async function GET(request: Request) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  if (!base) {
    return NextResponse.json({ error: "backend not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "10";

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/market/most-active?limit=${encodeURIComponent(limit)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_S },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
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
