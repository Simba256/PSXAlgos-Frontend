import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import {
  getStrategies,
  getStrategy,
  updateStrategy,
  deleteStrategy,
  type StrategyUpdateBody,
} from "@/lib/api/strategies";

async function authedJwt(): Promise<string | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });
}

function bubble(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, detail: err.body },
      { status: err.status },
    );
  }
  return NextResponse.json({ error: "server error" }, { status: 500 });
}

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await ctx.params;
  const id = parseId(raw);
  if (id === null) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const jwt = await authedJwt();
  if (jwt instanceof NextResponse) return jwt;
  try {
    return NextResponse.json(await getStrategy(jwt, id));
  } catch (err) {
    return bubble(err);
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await ctx.params;
  const id = parseId(raw);
  if (id === null) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const jwt = await authedJwt();
  if (jwt instanceof NextResponse) return jwt;
  let body: StrategyUpdateBody;
  try {
    body = (await req.json()) as StrategyUpdateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    // Manual rename: reject (409) if the typed name collides with another
    // strategy this user owns. Unlike the create path (POST), we don't
    // silently auto-suffix here — the user typed an exact name on purpose,
    // so they should know up-front rather than guess why their strategy is
    // suddenly called "Foo (1)". The editor surfaces the message in the
    // save toast.
    if (typeof body.name === "string" && body.name.length > 0) {
      const list = await getStrategies(jwt, { page: 1, page_size: 1000 }).catch(
        () => null,
      );
      if (list) {
        const conflict = list.items.find(
          (s) => s.id !== id && s.name === body.name,
        );
        if (conflict) {
          return NextResponse.json(
            {
              error: `A strategy named "${body.name}" already exists — pick a different name.`,
            },
            { status: 409 },
          );
        }
      }
    }
    return NextResponse.json(await updateStrategy(jwt, id, body));
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
  if (id === null) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const jwt = await authedJwt();
  if (jwt instanceof NextResponse) return jwt;
  try {
    return NextResponse.json(await deleteStrategy(jwt, id));
  } catch (err) {
    return bubble(err);
  }
}
