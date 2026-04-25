import { getPlans, type PlanResponse } from "@/lib/api/subscriptions";
import { PricingView, type PriceTable } from "./pricing-view";

function pickPrice(
  plans: PlanResponse[],
  name: string,
  interval: "month" | "year",
): number | null {
  const match = plans.find((p) => p.name === name && p.interval === interval);
  return match ? match.price_pkr : null;
}

export default async function PricingPage() {
  // Public marketing page — must not crash on backend hiccups. Try the live
  // fetch; fall back to design defaults baked into PricingView if it fails.
  let prices: PriceTable = {};
  try {
    const res = await getPlans();
    const proMonthly = pickPrice(res.plans, "pro", "month");
    const proYearly = pickPrice(res.plans, "pro", "year");
    const ppMonthly = pickPrice(res.plans, "pro_plus", "month");
    const ppYearly = pickPrice(res.plans, "pro_plus", "year");
    prices = {
      pro:
        proMonthly != null && proYearly != null
          ? { monthly: proMonthly, yearly: proYearly }
          : null,
      // Frontend's third tier is named "Quant" by design; backend's matching
      // row is `pro_plus`. Mapping here keeps the design copy intact while
      // pricing tracks the live plan row.
      quant:
        ppMonthly != null && ppYearly != null
          ? { monthly: ppMonthly, yearly: ppYearly }
          : null,
    };
  } catch (err) {
    console.warn("[/pricing] backend fetch failed; falling back to defaults", err);
  }

  return <PricingView prices={prices} />;
}
