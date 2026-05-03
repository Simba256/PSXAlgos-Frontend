import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signBackendJwt } from "@/lib/api/jwt";
import { listNotifications } from "@/lib/api/notifications";
import { NotificationsView } from "./notifications-view";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/?auth=required&from=/notifications");
  }
  const jwt = signBackendJwt({
    sub: session.user.id,
    email: session.user.email,
  });
  const initial = await listNotifications(jwt, { limit: 20 });
  return <NotificationsView initial={initial} />;
}
