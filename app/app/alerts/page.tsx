import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AlertsView } from "./alerts-view";

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/?auth=required&from=/alerts");
  }
  return <AlertsView />;
}
