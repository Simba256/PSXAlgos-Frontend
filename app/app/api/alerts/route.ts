import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";

const BACKEND_TIMEOUT_MS = 8_000;

function backendUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  if (!base) throw new Error("backend not configured");
  return `${base}${path}`;
}

async function backendFetch(url: string, jwt: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
        ...((init?.headers as Record<string, string>) ?? {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const jwt = signBackendJwt({ sub: session.user.id, email: session.user.email });
  const upstream = new URL(backendUrl("/alerts"));
  const includeTriggered = req.nextUrl.searchParams.get("include_triggered");
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (includeTriggered) upstream.searchParams.set("include_triggered", includeTriggered);
  if (symbol) upstream.searchParams.set("symbol", symbol);
  try {
    const res = await backendFetch(upstream.toString(), jwt);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json({ error: (body as { detail?: string }).detail ?? `upstream ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const jwt = signBackendJwt({ sub: session.user.id, email: session.user.email });
  try {
    const res = await backendFetch(backendUrl("/alerts"), jwt, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      return NextResponse.json({ error: (b as { detail?: string }).detail ?? `upstream ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "server error" }, { status: 500 });
  }
}
