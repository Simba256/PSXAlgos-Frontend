import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { unsubscribePush } from "@/lib/api/push";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let endpoint: string;
  try {
    const body = (await req.json()) as { endpoint?: string };
    if (!body.endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }
    endpoint = body.endpoint;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });
  try {
    return NextResponse.json(await unsubscribePush(jwt, endpoint));
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
