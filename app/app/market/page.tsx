import { MarketView } from "./market-view";

export const metadata = {
  title: "Market Overview — PSX",
  description: "Pakistan Stock Exchange market overview: indices, breadth, movers, and sectors.",
};

export default function MarketPage() {
  return <MarketView />;
}
