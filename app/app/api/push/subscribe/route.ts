import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { subscribePush, type PushSubscribePayload } from "@/lib/api/push";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: PushSubscribePayload;
  try {
    const body = (await req.json()) as Partial<PushSubscribePayload>;
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
    }
    payload = {
      endpoint: body.endpoint,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
      user_agent: req.headers.get("user-agent")?.slice(0, 255) ?? undefined,
    };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });
  try {
    return NextResponse.json(await subscribePush(jwt, payload));
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
