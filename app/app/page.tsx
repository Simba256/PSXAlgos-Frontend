import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LandingContent from "./landing-content";

// Authed users skip the marketing surface — there's nothing here for them
// once a session exists. /signals is the closest thing to a "home" view
// after sign-in.
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/signals");
  return <LandingContent />;
}
