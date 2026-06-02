// JSON-LD schema builders for /learn content. Pure functions — safe to call
// from server components. Everything links back to the Organization node
// emitted site-wide in app/layout.tsx via its @id, so search/answer engines
// resolve a single publisher identity across the whole site.
//
// Why these four types: research on AI-citation behaviour shows FAQPage +
// DefinedTerm + Article are the highest-yield structured-data types for
// "what is X" / "explain X" prompts, and BreadcrumbList anchors the page in
// the site hierarchy. See docs/CONTENT_GEO_PLAN.md.

export const SITE = "https://psxalgos.com";
export const ORG_ID = `${SITE}/#organization`;

export interface FaqItem {
  q: string;
  a: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/** Article schema for a learn page. `body` is the plain-text lead used as the
 *  articleBody summary — keep it short; the full prose lives in the DOM. */
export function articleSchema(opts: {
  url: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
  author: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${opts.url}#article`,
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    inLanguage: "en",
    author: { "@type": "Organization", name: opts.author, "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": `${SITE}/#website` },
  };
}

/** DefinedTerm for a glossary entry, scoped to a site-wide DefinedTermSet so
 *  the terms read as one coherent glossary rather than orphaned definitions. */
export function definedTermSchema(opts: {
  url: string;
  term: string;
  tldr: string;
  aka?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": `${opts.url}#term`,
    name: opts.term,
    description: opts.tldr,
    ...(opts.aka && opts.aka.length ? { alternateName: opts.aka } : {}),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      "@id": `${SITE}/learn#glossary`,
      name: "PSX Algos Glossary",
      url: `${SITE}/learn`,
    },
  };
}

export function faqSchema(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
