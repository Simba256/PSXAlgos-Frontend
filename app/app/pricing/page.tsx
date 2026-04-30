import { redirect } from "next/navigation";

// Pricing page is hidden while the paywall is disabled; any direct hit on
// /pricing bounces back to the marketing home. Restore the original
// PricingView render when re-enabling subscriptions.
export default function PricingPage() {
  redirect("/");
}
