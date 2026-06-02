// Server component — emits a JSON-LD <script>. No "use client": this renders
// to static HTML so crawlers and answer engines see the structured data in the
// initial response without executing JS. Reused by every /learn page.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
