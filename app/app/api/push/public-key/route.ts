import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { getPushPublicKey } from "@/lib/api/push";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    // No session — report "push unavailable" rather than erroring; the
    // toggle simply stays hidden.
    return NextResponse.json({ key: null });
  }
  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });
  try {
    return NextResponse.json(await getPushPublicKey(jwt));
  } catch {
    // Push is non-essential chrome — degrade to "not configured".
    return NextResponse.json({ key: null });
  }
}
