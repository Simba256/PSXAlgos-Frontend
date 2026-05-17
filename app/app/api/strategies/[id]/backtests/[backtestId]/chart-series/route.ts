// GET /api/strategies/[id]/backtests/[backtestId]/chart-series
// Proxy to FastAPI GET /strategies/{id}/backtests/{backtestId}/chart-series

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";

export interface BacktestOHLCBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface BacktestChartSeries {
  symbol: string;
  bars: BacktestOHLCBar[];
}

export interface BacktestChartSeriesResponse {
  series: BacktestChartSeries[];
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; backtestId: string }> },
) {
  const { id: rawId, backtestId: rawBt } = await ctx.params;
  const id = parseInt(rawId, 10);
  const backtestId = parseInt(rawBt, 10);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(backtestId) || backtestId <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const jwt = signBackendJwt({ sub: session.user.id, email: session.user.email });
  try {
    const data = await apiFetch<BacktestChartSeriesResponse>(
      `/strategies/${id}/backtests/${backtestId}/chart-series`,
      { jwt },
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, detail: err.body }, { status: err.status });
    }
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
