import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LandingContent from "./landing-content";

// Authed users skip the marketing surface — there's nothing here for them
// once a session exists. /strategies is the home for signed-in users:
// the strategy editor is where the platform's value lives, and signals/
// bots/backtest all flow downstream from a strategy.
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/strategies");
  return <LandingContent />;
}
