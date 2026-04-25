import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { ApiError } from "@/lib/api/client";
import { getStrategy } from "@/lib/api/strategies";
import { EditorView } from "./editor-view";

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
    const initialStrategy = await getStrategy(jwt, id);
    return <EditorView initialStrategy={initialStrategy} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
