import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { getBots, createBot, type BotCreateBody } from "@/lib/api/bots";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: BotCreateBody;
  try {
    body = (await req.json()) as BotCreateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });
  try {
    const existing = await getBots(jwt).catch(() => null);
    if (existing) {
      const conflict = existing.items.find((b) => b.name === body.name);
      if (conflict) {
        return NextResponse.json(
          { error: `A bot named "${body.name}" already exists — pick a different name.` },
          { status: 409 },
        );
      }
    }
    return NextResponse.json(await createBot(jwt, body));
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, detail: err.body }, { status: err.status });
    }
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
