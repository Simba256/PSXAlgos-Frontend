import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LandingContent from "./landing-content";

// WebApplication JSON-LD scoped to the marketing landing — pairs with the
// Organization/WebSite graph in layout.tsx. Lives here (not the layout) so
// it only renders on the public marketing surface, not on every authed
// app page where it would misrepresent the route.
const LANDING_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "PSX Algos",
  url: "https://psxalgos.com",
  applicationCategory: "FinanceApplication",
  applicationSubCategory: "Trading Strategy Backtesting",
  operatingSystem: "Web",
  inLanguage: "en",
  description:
    "Visual trading-strategy builder, backtester, signal feed, and paper-trading bot platform for the Pakistan Stock Exchange (PSX). Compose strategies as a tree of indicator conditions, backtest on a decade of PSX data, and deploy as live signals or simulated bots — no code.",
  featureList: [
    "Visual no-code strategy editor (tree of indicator conditions)",
    "Backtest on a decade of PSX end-of-day historical data",
    "Live signal feeds during PSX market hours",
    "Paper-trading bots with simulated execution",
    "RSI, MACD, moving averages, volume, ATR, Bollinger Bands",
    "Coverage of KSE-100, KSE-30, KSE-All Share, and KMI-30 constituents",
  ],
  offers: { "@type": "Offer", price: "0", priceCurrency: "PKR" },
  audience: {
    "@type": "Audience",
    audienceType: "Retail traders, finance students, and quant-curious developers in Pakistan",
  },
  publisher: { "@id": "https://psxalgos.com/#organization" },
};

// Authed users skip the marketing surface — there's nothing here for them
// once a session exists. /strategies is the home for signed-in users:
// the strategy editor is where the platform's value lives, and signals/
// bots/backtest all flow downstream from a strategy.
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/strategies");
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LANDING_JSONLD) }}
      />
      <LandingContent />
    </>
  );
}
