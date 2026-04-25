import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { updateBot, deleteBot, type BotUpdateBody } from "@/lib/api/bots";

async function authedJwt(): Promise<string | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return signBackendJwt({ sub: session.user.id, email: session.user.email });
}

function bubble(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, detail: err.body }, { status: err.status });
  }
  return NextResponse.json({ error: "server error" }, { status: 500 });
}

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await ctx.params;
  const id = parseId(raw);
  if (id === null) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const jwt = await authedJwt();
  if (jwt instanceof NextResponse) return jwt;
  let body: BotUpdateBody;
  try {
    body = (await req.json()) as BotUpdateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateBot(jwt, id, body));
  } catch (err) {
    return bubble(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await ctx.params;
  const id = parseId(raw);
  if (id === null) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const jwt = await authedJwt();
  if (jwt instanceof NextResponse) return jwt;
  try {
    return NextResponse.json(await deleteBot(jwt, id));
  } catch (err) {
    return bubble(err);
  }
}
