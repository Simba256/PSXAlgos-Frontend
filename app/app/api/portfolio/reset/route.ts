import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { resetPortfolio } from "@/lib/api/portfolio";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });
  try {
    return NextResponse.json(await resetPortfolio(jwt));
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, detail: err.body }, { status: err.status });
    }
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
