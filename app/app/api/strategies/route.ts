// Server-side proxy: client wizard POSTs here; this route mints a backend JWT
// from the NextAuth session and forwards to /strategies on the FastAPI backend.
// Forwarding (rather than letting the browser hit the backend directly) keeps
// the JWT on the server and lets us reuse the same env (NEXT_PUBLIC_API_BASE_URL)
// the server fetchers use.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import {
  createStrategy,
  getStrategies,
  type StrategyCreateBody,
} from "@/lib/api/strategies";

// Filename-style dedup: "Foo" → "Foo (1)" → "Foo (2)" → … until unused.
// Strips an existing trailing " (N)" before counting so the user doesn't
// end up with "Foo (1) (1)" when re-creating from a name that's already
// suffixed (matches macOS Finder / Google Drive behavior).
function nextAvailableName(desired: string, taken: Set<string>): string {
  if (!taken.has(desired)) return desired;
  const m = desired.match(/^(.+) \((\d+)\)$/);
  const base = m ? m[1] : desired;
  for (let i = 1; i < 10000; i++) {
    const candidate = `${base} (${i})`;
    if (!taken.has(candidate)) return candidate;
  }
  // Pathological fallback — 10000+ collisions on the same base.
  return `${base} (${Date.now()})`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: StrategyCreateBody;
  try {
    body = (await req.json()) as StrategyCreateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });

  try {
    // Pull the user's existing strategies and rewrite a colliding name with
    // the next available " (N)" suffix. Best-effort: if the list call fails
    // we fall through with the original name and let the backend save it
    // (duplicates are technically valid, just confusing in the list).
    if (body.name) {
      const list = await getStrategies(jwt, { page: 1, page_size: 1000 }).catch(
        () => null,
      );
      if (list) {
        const taken = new Set(list.items.map((s) => s.name));
        body.name = nextAvailableName(body.name, taken);
      }
    }
    const result = await createStrategy(jwt, body);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: err.message, detail: err.body },
        { status: err.status },
      );
    }
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
