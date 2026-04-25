# Future Triggers — Earned-at-signal Work

> Captured: 2026-04-25
> Source: `FRONTEND_REVIEW_2026-04-24.md` P3 bucket (originally merged from the since-deleted `FRONTEND_CONSISTENCY_FOLLOWUP.md` deferred items).
>
> These are **not** things to build now. Each item is a specific "if X happens, then do Y" rule. The code is fine without them today; the change becomes correct the moment its trigger fires. Keep this file grep-able — when a PR crosses a trigger, look the action up here, don't re-derive it.
>
> Rule for adding entries: name the observable signal, the action, the exact files to touch, and the failure mode the action prevents. If any of those is vague, the trigger isn't ready — keep iterating, or drop it.

---

## T1 · Backtest engine produces dynamic values → clamp `/backtest` Ledes

**Observable signal**: `app/backtest/page.tsx:215–220` switches any of the 6 Lede `value` props from a hardcoded string (`"+14.2%"`, `"1.84"`, `"−8.4%"`, `"62%"`, `"2.31"`, `"11d"`) to a computed value — state, fetch, or useMemo derivation from trade data.

**Action**: add `size="clamp(22px, 2.5vw, 28px)"` to all 6 Ledes in the top strip. This is the same clamp already used on `/portfolio` Ledes and `/bots/[id]` metric tiles — one shared "hero stat tile" clamp across the app.

**Why wait**: today's values fit the 6-col grid (~185px per tile at 1440px) with ~65px headroom. Applying the clamp today is prophylactic and adds a tiny bit of render cost for zero user-visible benefit. Once the engine produces values like `"+PKR 3,420,150"` or `"Sharpe 12.34"`, the default 40px size overflows.

**Files**: `app/backtest/page.tsx:215–220` (6 Lede tags).

**Failure if skipped**: tile text either wraps (breaks the strip's visual rhythm) or overflows the tile (horizontal scroll / occluded content).

---

## T2 · `/signals` or `/backtest` trade log crosses ~500 rows → virtualize `TerminalTable`

**Observable signal**: the `rows` array passed to `<TerminalTable>` in either `app/signals/page.tsx` or `app/backtest/page.tsx` (trade log section) can realistically reach 500+ — either backed by a fetch with no pagination, or a multi-year backtest result set.

**Action**:
1. Add `@tanstack/react-virtual` (accept the new dep — there is no stdlib equivalent).
2. Extract a memoized row factory inside `components/atoms.tsx` `TerminalTable` — each row receives `(row, cols)` and returns a cell tuple, memo-keyed by row id.
3. Replace the current `onMouseEnter`/`onMouseLeave` style mutations (`components/atoms.tsx:471,478`) with a CSS `:hover` rule. React renders stop mutating DOM style on every hover.
4. Swap `tbody` rendering for the virtualizer's `getVirtualItems()` windowed slice; keep the `<thead>` / footer outside the viewport.

**Why wait**: today's tables are ≤ 50 rows of static data. Virtualizing adds complexity (scroll container sizing, sticky header gymnastics, `@tanstack/react-virtual` dep) that costs more than it saves at current scale. React Compiler handles the memoization we'd get from `useMemo` today.

**Files**: `components/atoms.tsx` (TerminalTable + Col types), `app/signals/page.tsx`, `app/backtest/page.tsx`. Desktop path only; mobile card-list path is already virtualization-friendly (vertical scroll, one Card per row).

**Failure if skipped**: INP regression (hover mutations on 500+ rows cause observable jank), scroll jank, memory bloat in long sessions.

---

## T3 · Multi-tab or server-mediated signals arrive → retire the localStorage bridge

**Observable signal**: either (a) a "signals across tabs must stay in sync" requirement lands, or (b) `/signals` starts sourcing from a server endpoint instead of the current static const.

**Action**:
- If (a) — replace `lib/signal-log-bridge.ts` localStorage read/write with `BroadcastChannel("psx-signals")`. Same `enqueue` / `drain` interface; the channel auto-fans the event to every open tab.
- If (b) — delete `lib/signal-log-bridge.ts` entirely. The portfolio page becomes a subscriber to the same server state (SWR / tanstack-query / server actions); the "pending trade" concept collapses into optimistic updates.

**Why wait**: today the bridge is a one-shot handoff from `/signals` to `/portfolio` within the same tab. localStorage is the simplest thing that works; BroadcastChannel would solve a problem nobody has.

**Files**: `lib/signal-log-bridge.ts` (49 LOC — drop or rewrite), `app/signals/page.tsx` (enqueue site), `app/portfolio/page.tsx` (drain site).

**Failure if skipped**: silently lost trades on tab 2 (if signal fires in tab 1). Not a bug today — only surfaces when users actually open multiple tabs.

---

## T4 · Any real `fetch` / server action replaces a static const → loading states + Suspense

**Observable signal**: any `useState(INITIAL_*)` or `const DATA = [...]` is swapped for a `fetch()`, a React server component data prop, or a server action. First route to change will likely be `/signals` or `/portfolio`.

**Action**:
1. Add a `<Skeleton />` atom to `components/atoms.tsx` — a shimmering block matching the dimensions of whatever it replaces (card, row, chart). Uses the existing token system (`T.surface2`, `T.surface3`) for the gradient.
2. Wrap each data-bound region in `<Suspense fallback={<Skeleton kind="..." />}>`. Route-level `loading.tsx` files if the whole page is data-bound.
3. Error path: a thin `<DataError onRetry={...}>` that reuses the existing `error.tsx` visual language.

**Why wait**: today everything is static const data. Skeletons for static data are dead loops. Building the skeleton library before the data-fetching pattern exists means guessing at dimensions and states — easier to build each skeleton against its real consumer.

**Files**: `components/atoms.tsx` (add Skeleton), per-route `loading.tsx` files under `app/` as needed, individual pages for `<Suspense>` boundaries.

**Failure if skipped**: bare "no data yet" flashes, janky re-renders when the fetch resolves, no perceived performance from streaming.

---

## T5 · Long strategy names reach Step 3 heading → truncate with title fallback

**Observable signal**: `preset.defaultName` (or user-edited strategy name) can realistically exceed ~18 characters at desktop or ~12 characters at mobile, measured against the 36px Space Grotesk headline at `app/strategies/new/page.tsx:737`.

**Action**: add to the heading `<div>` wrapping `{preset.defaultName}`:
```tsx
style={{
  ...,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}}
title={preset.defaultName}
```
The `title` attr keeps the full name accessible (native tooltip + screen readers announce `aria-describedby`-adjacent content via the accessible name).

**Why wait**: current presets have short names (`"Momentum breakout"`, etc.) that fit comfortably. User-edited names are capped at 50 chars (see the counter directly below) but average stays short. Overflow is theoretical.

**Files**: `app/strategies/new/page.tsx:731–743` (the Step 3 "Name" section).

**Failure if skipped**: headline wraps to a 2nd line, shoving the blinking caret `|` span to a new line and breaking the typing-in-progress visual metaphor.

---

## T6 · Help / Support / Contact page ships → consistent nav position

**Observable signal**: a PR adds a Help, Support, Contact, or Docs link to `MarketingNav` or `TopNav` in `components/frame.tsx`.

**Action**: place the link in the **same relative position on every page/nav that has navigation**. Convention (pick one, document in `frame.tsx` comment): rightmost nav slot before the CTA, or leftmost of the secondary group. Never reorder per-page.

**Why**: WCAG 2.2 SC 3.2.6 "Consistent Help" (Level A). If help is available on multiple pages, it must be in the same relative order. The spec is about predictability for users with cognitive disabilities, not just convention.

**Failure if skipped**: direct WCAG SC 3.2.6 failure — accessibility audits flag this immediately.

---

## T7 · Urdu localization considered → RTL audit before structural debt

**Observable signal**: any of — user research mentions Urdu, copy gets translated, `lang="ur"` shows up in a conversation, or an `i18n` lib (next-intl, react-intl, lingui) hits `package.json`.

**Action** (do **before** translating anything):
1. Sweep every inline style for direction-biased properties: `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight`, `textAlign: "left"` / `"right"`, `borderLeft*`, `borderRight*`, `left: ...`, `right: ...`, `transform: translateX(...)` with negative values.
2. Replace with logical properties: `marginInlineStart`, `marginInlineEnd`, `paddingInline`, `textAlign: "start"` / `"end"`, `borderInlineStart*`, `insetInlineStart`, `insetInlineEnd`.
3. Verify icons that have directional meaning (arrows, chevrons, play, "→" glyphs in CTAs like `"Deploy →"`) — they need mirroring in RTL, usually via `transform: scaleX(-1)` scoped to `[dir="rtl"]`.
4. The app's charts (`components/charts.tsx`) need an explicit decision — candlestick time axes typically stay LTR even in RTL layouts (finance convention). Document the chosen convention.

**Why wait**: every inline-style file in the project is LTR-biased today (multi-hundred sites). Rewriting before a translation PR is premature; but the translation PR itself must not also migrate to logical properties — the reviewer can't follow two refactors at once. Do the RTL migration first, translation second.

**Files**: every `.tsx` file in `app/` and `components/`. Expect a multi-day sweep.

**Failure if skipped**: visual breakage in RTL (text left-justified in a right-justified layout, chevrons pointing the wrong way, negative-margin overlaps), or a split-brain codebase where some files use logical properties and others don't.

---

## T8 · A specific user asks for print → `@media print` in `globals.css`

**Observable signal**: a user (or stakeholder) actually asks to print a `/portfolio`, `/backtest`, or `/signals` view. Not "shouldn't we have print styles?" — an actual ask.

**Action**: add to `app/globals.css`:
```css
@media print {
  /* Strip chrome */
  nav, header, footer, [data-hide-print] { display: none !important; }
  body { background: white !important; color: black !important; }
  /* Expand virtualized tables (if T2 has fired) to print all rows */
  [data-table] { overflow: visible !important; height: auto !important; }
  /* Avoid page breaks inside rows/cards */
  tr, [data-card] { break-inside: avoid; }
}
```
Then mark print-irrelevant UI (ThemeToggle, hamburger, Flash toasts, modals, hover states) with `data-hide-print`.

**Why wait**: nobody has asked. Print is a long-tail use case; pre-emptive styles rot without eyes on them.

**Files**: `app/globals.css`, selective `data-hide-print` attributes on chrome components.

**Failure if skipped**: if someone prints today, they get the full dark Amber UI printed on paper — black rectangles wasting toner, nav and hamburger chrome, no page-break hints. Ugly, but not broken.

---

## Housekeeping

- Review this file when touching `FRONTEND_REVIEW_2026-04-24.md` or `PROJECT_TRACKER.md`.
- If a trigger fires and its action lands, **move the entry to `PROJECT_TRACKER.md` Recently Completed** and delete it here.
- If a trigger turns out to be wrong (signal never materializes, or materializes in a different shape), **retire the entry** with a one-line rationale in the project tracker's Key Decisions log so future-us can learn from it.
