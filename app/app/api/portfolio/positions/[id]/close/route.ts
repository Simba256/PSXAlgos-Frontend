import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { closeOpenPosition, type ClosePositionBody } from "@/lib/api/portfolio";

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await ctx.params;
  const id = parseId(raw);
  if (id === null) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: ClosePositionBody;
  try {
    body = (await req.json()) as ClosePositionBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });
  try {
    return NextResponse.json(await closeOpenPosition(jwt, id, body));
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, detail: err.body }, { status: err.status });
    }
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
