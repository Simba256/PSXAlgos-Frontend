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
  // Wrap so a Railway 5xx / Neon hiccup degrades to an empty list + flash
  // toast on mount, instead of surfacing Next.js's global error boundary
  // and wiping the page. Mirrors /portfolio + /bots + /signals + /strategies.
  let fetchFailed = false;
  const initial = await listNotifications(jwt, { limit: 20 }).catch(() => {
    fetchFailed = true;
    return { items: [], next_cursor: null, unread_count: 0 };
  });
  return <NotificationsView initial={initial} fetchFailed={fetchFailed} />;
}
