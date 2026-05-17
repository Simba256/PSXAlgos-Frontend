import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WatchlistsView } from "./watchlists-view";

export default async function WatchlistsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/?auth=required&from=/watchlists");
  }
  return <WatchlistsView />;
}
