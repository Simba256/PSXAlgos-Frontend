import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { botAction, type BotAction } from "@/lib/api/bots";

const ALLOWED: ReadonlySet<BotAction> = new Set<BotAction>(["start", "pause", "stop"]);

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; action: string }> },
) {
  const { id: rawId, action: rawAction } = await ctx.params;
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  if (!ALLOWED.has(rawAction as BotAction)) {
    return NextResponse.json({ error: "bad action" }, { status: 400 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const jwt = signBackendJwt({ sub: session.user.id, email: session.user.email });
  try {
    return NextResponse.json(await botAction(jwt, id, rawAction as BotAction));
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, detail: err.body }, { status: err.status });
    }
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
