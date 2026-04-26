import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { getIndicatorMeta, getStrategy, type IndicatorMeta } from "@/lib/api/strategies";
import { EditorView } from "./editor-view";

// Empty fallback so the editor stays usable if the meta endpoint is down —
// the picker just shows nothing, but conditions still render and persist.
const EMPTY_META: IndicatorMeta = {
  indicators: {},
  operators: [],
  position_sizing_types: [],
};

export default async function StrategyEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/?auth=required&from=/strategies/${raw}`);
  }

  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });

  try {
    const [initialStrategy, indicatorMeta] = await Promise.all([
      getStrategy(jwt, id),
      getIndicatorMeta().catch(() => EMPTY_META),
    ]);
    return <EditorView initialStrategy={initialStrategy} indicatorMeta={indicatorMeta} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
