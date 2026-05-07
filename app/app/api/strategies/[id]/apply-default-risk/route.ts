// POST /api/strategies/[id]/apply-default-risk — resolves the inheritance
// warning returned by PUT /api/strategies/[id] when default_risk changed.
// Body shape: ApplyDefaultRiskRequest from `lib/api/strategies`. Phase 6.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import {
  applyDefaultRisk,
  type ApplyDefaultRiskRequest,
} from "@/lib/api/strategies";

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
  let body: ApplyDefaultRiskRequest;
  try {
    body = (await req.json()) as ApplyDefaultRiskRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const jwt = signBackendJwt({ sub: session.user.id, email: session.user.email });
  try {
    return NextResponse.json(await applyDefaultRisk(jwt, id, body));
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
