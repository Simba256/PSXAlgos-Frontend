import type { Metadata } from "next";
import { LearnHub, type HubItem } from "@/components/learn-hub";
import { JsonLd } from "@/components/json-ld";
import { glossaryEntries } from "./_content";
import { SITE, breadcrumbSchema } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "Learn the PSX — Indices, Indicators & Trading Terms | PSX Algos",
  description:
    "Clear definitions of Pakistan Stock Exchange indices, market mechanics, and trading indicators — from the KSE-100 to RSI and MACD, with worked examples.",
  alternates: { canonical: "/learn" },
  openGraph: {
    type: "website",
    title: "Learn the PSX — Indices, Indicators & Trading Terms",
    description:
      "Definitions of PSX indices, market mechanics, and trading indicators, with worked examples.",
    url: `${SITE}/learn`,
  },
};

export default function LearnIndexPage() {
  const items: HubItem[] = glossaryEntries().map((e) => ({
    slug: e.slug,
    term: e.term,
    tldr: e.tldr,
    category: e.category,
  }));

  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE}/learn#collection`,
    name: "PSX Algos Glossary",
    url: `${SITE}/learn`,
    isPartOf: { "@id": `${SITE}/#website` },
    about: { "@id": `${SITE}/#organization` },
  };

  return (
    <>
      <JsonLd data={collection} />
      <JsonLd data={breadcrumbSchema([{ name: "Learn", url: `${SITE}/learn` }])} />
      <LearnHub items={items} />
    </>
  );
}
