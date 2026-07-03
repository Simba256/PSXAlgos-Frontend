import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import {
  getBot,
  getBotPositions,
  getBotPerformance,
  type PerformanceResponse,
} from "@/lib/api/bots";
import { BotDetailView } from "./bot-detail-view";

export default async function BotDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/?auth=required&from=/bots/${raw}`);
  }
  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });

  let initialBot;
  try {
    initialBot = await getBot(jwt, id);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) notFound();
      // 401 = the backend rejected our session token (expired or no longer
      // valid). Mirror the no-session path above and bounce to re-auth instead
      // of surfacing a raw 401 to the user — a fresh sign-in mints a valid
      // token. (403 is a genuine authorization error, so let it fall through.)
      if (err.status === 401) {
        redirect(`/?auth=required&from=/bots/${raw}`);
      }
    }
    throw err;
  }

  // Positions and performance can fail independently without breaking the
  // page; surface them as empty.
  const [positionsRes, performanceRes] = await Promise.allSettled([
    getBotPositions(jwt, id, "OPEN"),
    getBotPerformance(jwt, id, 30),
  ]);
  const initialPositions =
    positionsRes.status === "fulfilled" ? positionsRes.value.items : [];
  const initialPerformance: PerformanceResponse | null =
    performanceRes.status === "fulfilled" ? performanceRes.value : null;

  return (
    <BotDetailView
      initialBot={initialBot}
      initialPositions={initialPositions}
      initialPerformance={initialPerformance}
    />
  );
}
