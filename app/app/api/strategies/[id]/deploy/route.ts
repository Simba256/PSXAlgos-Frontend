// POST /api/strategies/[id]/deploy — deploys the strategy and (optionally)
// captures the universe (stock_filters / stock_symbols) the signal scanner
// should use. B047. Body is optional — body-less deploys persist NULL/NULL
// and the scanner produces zero signals until the user re-deploys with a
// universe.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { deployStrategy, type DeployRequest } from "@/lib/api/signals";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await ctx.params;
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Body is optional. If the request omits one or sends an empty payload,
  // pass undefined to the wrapper so it sends no Content-Type.
  let body: DeployRequest | undefined;
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as DeployRequest;
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
  }
  const jwt = signBackendJwt({ sub: session.user.id, email: session.user.email });
  try {
    return NextResponse.json(await deployStrategy(jwt, id, body));
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
