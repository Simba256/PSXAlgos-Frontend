import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { addFunds } from "@/lib/api/portfolio";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { amount?: number };
  try {
    body = (await req.json()) as { amount?: number };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const amt = Number(body.amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }
  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });
  try {
    return NextResponse.json(await addFunds(jwt, amt));
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, detail: err.body }, { status: err.status });
    }
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
