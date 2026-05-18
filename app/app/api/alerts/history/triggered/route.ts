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
  const upstream = new URL(backendUrl("/alerts/history/triggered"));
  const limit = req.nextUrl.searchParams.get("limit");
  if (limit) upstream.searchParams.set("limit", limit);
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
