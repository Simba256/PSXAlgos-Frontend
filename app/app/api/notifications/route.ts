import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { listNotifications, type ListParams } from "@/lib/api/notifications";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const params: ListParams = {};
  const unreadOnly = url.searchParams.get("unread_only");
  if (unreadOnly !== null) params.unread_only = unreadOnly === "true";
  const limit = url.searchParams.get("limit");
  if (limit !== null) {
    const n = parseInt(limit, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 50) params.limit = n;
  }
  const cursor = url.searchParams.get("cursor");
  if (cursor) params.cursor = cursor;

  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });
  try {
    return NextResponse.json(await listNotifications(jwt, params));
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
