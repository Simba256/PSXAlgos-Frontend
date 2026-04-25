// Server-side proxy: client wizard POSTs here; this route mints a backend JWT
// from the NextAuth session and forwards to /strategies on the FastAPI backend.
// Forwarding (rather than letting the browser hit the backend directly) keeps
// the JWT on the server and lets us reuse the same env (NEXT_PUBLIC_API_BASE_URL)
// the server fetchers use.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { createStrategy, type StrategyCreateBody } from "@/lib/api/strategies";

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
