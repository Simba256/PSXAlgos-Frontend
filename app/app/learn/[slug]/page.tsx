import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LearnArticle } from "@/components/learn-article";
import { JsonLd } from "@/components/json-ld";
import { getEntry, allSlugs } from "../_content";
import {
  SITE,
  articleSchema,
  definedTermSchema,
  faqSchema,
  breadcrumbSchema,
} from "@/lib/seo/schema";

export function generateStaticParams() {
  return allSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) return {};
  const url = `${SITE}/learn/${entry.slug}`;
  return {
    title: entry.metaTitle,
    description: entry.metaDescription,
    alternates: { canonical: `/learn/${entry.slug}` },
    openGraph: {
      type: "article",
      title: entry.metaTitle,
      description: entry.metaDescription,
      url,
    },
    twitter: { card: "summary_large_image", title: entry.metaTitle, description: entry.metaDescription },
  };
}

export default async function LearnTermPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry || entry.type !== "glossary") notFound();

  const url = `${SITE}/learn/${entry.slug}`;

  return (
    <>
      <JsonLd
        data={articleSchema({
          url,
          headline: entry.term,
          description: entry.metaDescription,
          datePublished: entry.published,
          dateModified: entry.updated,
          author: entry.author,
        })}
      />
      <JsonLd data={definedTermSchema({ url, term: entry.term, tldr: entry.tldr, aka: entry.aka })} />
      <JsonLd data={faqSchema(entry.faqs)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Learn", url: `${SITE}/learn` },
          { name: entry.term, url },
        ])}
      />
      <LearnArticle entry={entry} />
    </>
  );
}
