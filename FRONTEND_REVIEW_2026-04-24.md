# Frontend Review — 2026-04-24 (Consolidated)

Five-angle audit of the PSX Algos frontend (code quality, accessibility, performance, security, layout resilience). No code was edited in any pass — agents reported only.

This file is the synthesis: what the five views agree on, what is genuinely broken today, what is earned to fix, what is earned to defer. The individual per-angle reports were deleted in the 2026-04-25 cleanup once P0–P3 closed; everything actionable from them is captured here, in `PRE_AUTH_DECISIONS.md` (P2 ADRs), or `FUTURE_TRIGGERS.md` (P3 signal→action registry).

---

## Headline

**The codebase is structurally healthy at its size (~8.6k LOC, 3 runtime deps, 0 chart/UI/state libs, 0 `dangerouslySetInnerHTML`, 0 external scripts).** Most of the quality bar the survey + consistency follow-up set is holding — `minmax(0, 1fr)` discipline is applied where it's earned, the atom library is reused at 91 call sites, accessibility literacy is real (`aria-live`, `aria-modal`, Escape handlers, radio-group wizards, reduced-motion, iOS 16px inputs).

**The five biggest systemic gaps — flagged independently by more than one auditor — are:**

1. **Every page is `"use client"`** → Next 16 PPR / Cache Components / RSC / `error.tsx` all unused. Biggest single LCP + architecture lever. (Code quality + Performance.)
2. **Modal primitive scattered across 5 files** → inconsistent scroll-lock, focus-trap, focus-return, Escape. (Code quality + A11y + Layout.)
3. **Paper `text3` (`#7a756a`) at ~3.2–3.6:1** is the dominant supporting-text color site-wide → fails WCAG AA on every page. (A11y + Layout.)
4. **`useBreakpoint` defaults to width 1280** → mobile first-paint is desktop layout, then reflows. Each consumer also registers its own listener. (Performance + Layout → CLS source.)
5. **Pre-auth architecture is at a decision point** — security headers missing, `ngrok` wildcards not prod-gated, session-token storage undecided, trade-button tiering undesigned. Locking these in *before* OAuth lands is 10× cheaper than after. (Security.)

Two bugs are broken **today**:

- `app/brand/page.tsx:11` — `PAD[bp]` is `undefined` at runtime (only repo TS error).
- `app/strategies/page.tsx:586` — `Math.random()` fallback ID means re-importing the same JSON duplicates rows instead of merging.

---

## Reports at a glance

| Review | Pass rate / posture | Biggest finding |
|---|---|---|
| Code Quality | Healthy for size; 1 real bug, 2 god files, 5× duplicated FlashToast | Every page is `"use client"` — Next 16 value unclaimed |
| Accessibility | ~55–60% AA conforming | No `:focus-visible` anywhere; Paper `text3` fails contrast globally |
| Performance | Predicted LCP 1.8–2.6 s / CLS 0.05–0.15 | Whole app opts out of RSC; `useBreakpoint` default 1280 causes first-paint reflow |
| Security | Cleaner than most audits expect today | No security headers in `next.config.ts`; pre-empt httpOnly cookies + tiered trade buttons before auth lands |
| Layout Resilience | Strong at 375/1440; weak at tablet and ≥1920 | Tablet band (640–1279) collapses most grids to 1-col; modal hygiene inconsistent |

---

## Cross-cutting themes

### T1 · Next 16 / React 19 has been adopted as a build target, not as an architecture

The `AGENTS.md` warning ("This is NOT the Next.js you know") is earned: Next 16 introduces Cache Components, Activity preservation, Partial Prerendering, typed routes, `cacheComponents` / `use cache`, and it works well with React 19's Actions / `useActionState` / `useOptimistic` / `useTransition`. **None of these are in use.** Every page is `"use client"`; no `error.tsx` boundaries exist; no `<Suspense>` boundaries exist; no intermediate `layout.tsx` (so TopNav unmounts on every navigation); `reactCompiler: true` not set; `cacheComponents: true` not set; typed-route casts (`href={item.href as "/strategies"}`) silence the typing.

This is the single highest-leverage axis in the whole review. The reason to defer wholesale migration is real: `useT()` is a client context and every component styles through it, so server-ifying marketing pages requires a CSS-variable escape valve first. But three wins are cheap and standalone:

- `reactCompiler: true` in `next.config.ts` — auto-memoizes hundreds of inline style recipes, no code changes needed.
- `error.tsx` per route group — prevents a thrown render error from white-screening the app.
- Intermediate `layout.tsx` for app vs marketing — TopNav stops unmounting on navigation.

### T2 · Modal primitive needs to be extracted

Three independent audits flag it. Five modal implementations today (`auth-modal.tsx`, `portfolio ModalShell`, `signals LogTradeModal`, `bots/[id] LogsModal`, plus the three `/strategies/[id]` drawers that behave like modals on mobile). Of those:

- 1 of 5 locks body scroll (only AuthModal; drawers also lock).
- 1 of 5 manages focus (AuthModal — and it doesn't restore on close).
- 4 of ~8 dismissible surfaces handle Escape.
- 3 of 5 have no accessible close button name.
- All share a byte-for-byte overlay shell (`position: fixed, inset: 0, rgba(0,0,0,0.5), z: 999`).

A single `useModal({ onClose })` hook + `<Modal>` shell in `components/atoms.tsx` closes **three** findings at once (code quality duplication, a11y focus trap, layout scroll leak) and deduplicates the overlay styling.

### T3 · Paper theme has a systemic contrast hole

Paper `text3` = `#7a756a` — the dominant supporting-text color used for kickers, metadata, timestamps, sub-captions, footers across every route. Contrast ratios:

| Surface | Ratio | AA normal text (4.5:1) |
|---|---|---|
| `surface` (`#f7f3ea`) | ~3.27:1 | FAIL |
| `surfaceLow` (`#faf7ee`) | ~3.35:1 | FAIL |
| `surface2` (`#ffffff`) | ~3.6:1 | FAIL |
| `surface3` (`#ece6d6`) | ~3.1:1 | FAIL |

Amber's `text3` (`#8a8066` on `#0a0906`) is ~6.6:1 — passes. **This is a single palette change in `components/theme.tsx:69` that ripples across every route with zero consumer edits.** Darken to `#5f5a4e` (~5:1) or `#545045` (~6:1). Similarly `primaryLight` (`#2a7a54`) is ~4.15:1 on surface — borderline, failing AA at sub-18pt; swap to `primary` (`#1f5c3f` = ~6.3:1) for inline text at small sizes.

### T4 · Tablet band (640–1279 px) is the weakest part of the responsive system

The two tuning viewports have been 375 and 1440. The `mobile < 640 / tablet < 1024 / desktop ≥ 1024` split means almost every grid treats tablet as either mobile (1-col, wasting half the viewport on iPad portrait) or desktop (jamming 5–6 tiles into 600ish px). Specifically:

- `/pricing` tier cards stack to 1-col at 1024×768.
- `/` "How it works" stacks to 1-col at 1024×768.
- `/bots/new` + `/strategies/new` wizard previews drop below the form at tablet.
- `/portfolio` source-attribution cards stack to 1-col at tablet — which is the whole point of the side-by-side comparison.
- Nav hamburger kicks in at 1023 px when the full nav would easily fit.
- `/bots/[id]` 6-tile metric grid at exactly 1024 px overflows tiles into each other (no `overflow: hidden` on `Lede` value span).

None of these appear on the two tuning viewports, all of them appear on common iPad-class devices. Fix is a shared pattern: add a real tablet value to the `pick()` calls for these grids, or widen "desktop" to start at tablet.

### T5 · Three real-data cliffs are pre-scheduled

Deferring isn't the risk — speculative optimization is. But three deferrals need to fire at known triggers:

- **`TerminalTable` virtualization + memoization** → when `/signals` feed or backtest trade log crosses ~500 rows.
- **`/backtest` `Lede` clamp** → when the backtest engine produces dynamic values (not demo constants).
- **`lib/signal-log-bridge.ts` concurrency** → if multi-tab or server-roundtrip arrives.

None of these warrant pre-building. All three belong on a "first thing to do the day real data lands" checklist.

---

## P0 — Broken today (fix before next demo)

| # | Where | What | Source |
|---|---|---|---|
| P0-1 | `app/brand/page.tsx:11` | `PAD[bp]` is `undefined` — horizontal padding on `/brand` is effectively zero on mobile; only current repo TS error | Code Quality |
| P0-2 | `app/strategies/page.tsx:586` | `Math.random()` ID fallback; re-importing same JSON duplicates rows | Code Quality |
| P0-3 | `app/globals.css` (missing rule) + 4 drawer `outline: "none"` sites | No `:focus-visible` anywhere → WCAG 2.4.7 (Level A) fails site-wide | Accessibility |
| P0-4 | `app/strategies/[id]/page.tsx:882, 950, 1131` | CondNode / ExecNode / GroupBox have `role="button"` + `tabIndex={0}` but no `onKeyDown` → Enter/Space dead → WCAG 2.1.1 (A) fails on the editor | Accessibility |
| P0-5 | `app/portfolio/page.tsx:156–168` | `forceEmpty` demo toggle silently gates CSV export + import → user imports, sees nothing, panics | Code Quality |
| P0-6 | `app/bots/page.tsx:69` | Stale closure in `setTimeout` in `handleRefresh` — flash reports pre-pause count | Code Quality |

Each is small and self-contained. P0-3 is a single `globals.css` rule; P0-4 is adding 3 keyboard handlers (the identical pattern in `atoms.tsx` already works correctly, so this is drift).

---

## P1 — Earned wins (cheap, high-leverage, no architecture decision required)

Ordered by cost × impact. Each names the specific failure mode it defends against.

| # | Fix | Defends against | Cost |
|---|---|---|---|
| P1-1 | Ship security headers in `next.config.ts` (CSP + HSTS + X-Frame-Options + Referrer-Policy + Permissions-Policy) | Clickjacking today; CSP foundation for when auth lands | ~30 lines config |
| P1-2 | Gate `allowedDevOrigins` behind `process.env.NODE_ENV !== "production"` | ngrok wildcard leaking to prod | 3 lines |
| P1-3 | Darken Paper `text3` to `#5f5a4e` (~5:1) and stop using `primaryLight` for <18pt inline text in Paper | Systemic WCAG 1.4.3 fail across every page | 1 token change + grep-sweep of `primaryLight` usages |
| P1-4 | `reactCompiler: true` in `next.config.ts` | Hundreds of inline style recipes re-allocated per render; no React.memo discipline | 1 line + `npm i babel-plugin-react-compiler` |
| P1-5 | Fix `useBreakpoint` SSR default (use `useSyncExternalStore` or gate first render on `hydrated`) | Mobile users get desktop-layout first paint → real CLS | 15–20 lines in `components/responsive.tsx` |
| P1-6 | Consolidate `useBreakpoint` to a single root listener + context | N listeners per page; resize-storm re-renders | One provider, swap hook body |
| P1-7 | Extract `<Modal>` + `useModal()` in `components/atoms.tsx`; apply to all 5 modals + 3 drawers | Scroll-lock gap (3/5), focus-trap gap (5/5), focus-restore gap (5/5), Escape gap (4/8), `aria-label="Close"` gap (3 drawers) | ~30 LOC hook, ~8 call-site swaps |
| P1-8 | Extract `<FlashToast>` + `useFlash()` in atoms | 5× duplicated markup; 5× duplicated timeout effect; AA2.2.2 dismiss-timing | ~25 LOC |
| P1-9 | Add skip-to-content link + `<main>` / `<header>` / `<footer>` landmarks | WCAG 2.4.1 (Level A) | 1 link + 4 wrapper elements |
| P1-10 | `aria-label="Close drawer"` on 3 drawer close buttons; `aria-hidden="true"` on all 18 icons in `icons.tsx` | WCAG 4.1.2 | 21 attribute additions |
| P1-11 | Bump `Btn size="sm"`, `ThemeToggle`, `ZoomBtn`, drawer close, ExitRow switch to ≥24×24 CSS px | WCAG 2.2 SC 2.5.8 (new) | Padding bumps, ~6 sites |
| P1-12 | Swap `100vh` → `100dvh` in `frame.tsx:336, 401`, `app/page.tsx:40`, `pricing:116`, `brand:16`, 3 modal max-heights | iOS Safari URL-bar collapse jitter | 7 replacements |
| P1-13 | Fix theme SSR flash: inline `<script>` in layout that reads `localStorage` before React hydrates | Every dark-mode user sees Paper → Amber flash on every load | ~10 lines |
| P1-14 | Slim `next/font` weights: drop `weight: [...]` on Plex Sans + Space Grotesk (use variable), drop Plex Mono 600 | ~100 KB of unused font payload | 3-line config edit |
| P1-15 | Add `error.tsx` at route-group level | White-screen on any thrown render error (e.g. `EquityCurve` with empty data) | 1 file per route group |
| P1-16 | Move nav-hamburger threshold from `<1024` to `<900` | Hides full nav at 1023 when it fits comfortably | 1 constant change |
| P1-17 | Add `overflow: hidden; text-overflow: ellipsis; title={value}` to `Lede` value span + `TerminalTable` desktop cell | `/bots/[id]` 6-col at 1024px overflows; dynamic content has no tooltip recovery | 2 edits in `atoms.tsx` |
| P1-18 | Widen tablet pick in `pricing`, `page.tsx` "how it works", both wizards, portfolio attribution | Tablet viewport wastes half the screen or stacks a side-by-side component | 4 `pick()` edits |
| P1-19 | Extract FlashToast + CSV utilities + `todayLabel` / `newId` to `lib/*` | `portfolio/page.tsx` at 1,731 LOC hosting a CSV parser | Pure refactor, no behavior change |
| P1-20 | Drop `role="menu"` / `role="menuitem"` from SortControl + HistoryPopover **or** implement roving-tabindex | ARIA says "menu" but focus management doesn't exist — WCAG 2.1.1 | Remove 2 lines (simpler fix) |

**All 20 items clear the earned-complexity bar:** each names a specific failure mode, none requires an architecture decision, none pre-builds for a hypothetical requirement.

---

## P2 — Pre-empt-before-auth architecture (decide now, build when backend lands)

These aren't fixes — they're decisions that calcify the moment real code lands. The cost of making them later is 10× the cost of making them now.

1. **Session tokens → httpOnly + Secure + SameSite=Lax cookies, never `localStorage`.** The project already uses `localStorage` freely (`psxalgos-theme`, `psx:portfolio:pending-signal-trades`). The temptation to put a session token in `localStorage` will be real. Decide against it now, document it, add a lint rule.
2. **OAuth redirect allowlist.** No `redirectTo` / `next` / `returnTo` params exist yet. When they're added, enforce: path starts with `/`, not `//`, parsed URL `origin` matches app origin.
3. **Tier action buttons by blast radius.** Today `Deploy →`, `Launch bot →`, `Pause/Resume` are all single-click state flips. When they wire to real endpoints: (a) read-only = 1-click; (b) paper-account state flip = 1-click + toast; (c) deploy live / launch live bot = confirmation modal (type strategy name) + server rate-limit + re-auth for high-value actions.
4. **`NEXT_PUBLIC_*_SECRET|KEY|TOKEN` → CI failure.** Lint rule that fails the build.
5. **Sentry / analytics data capture policy.** Default SDKs capture form inputs and breadcrumbs — trade symbols, quantities, prices, eventual account IDs. Scrub before wiring; disable session replay on financial pages.
6. **Server-component marketing pages** (requires CSS-variable escape valve from `useT()`). Plan the migration: `theme.tsx` already sets `body.style.background` on mode change — extend to set `--surface`, `--text` etc. as CSS vars; marketing pages read `var(--text)` and become pure server components; `ThemeToggle`, `AuthModal`, scroll-to buttons become client islands. Unlocks PPR / `cacheComponents: true` / `unstable_instant`.
7. **`useActionState` / `useFormStatus` / `useOptimistic` for wizards.** React 19's form primitives auto-pend the submit button and make wizard double-click idempotent. Adopt when each step gets a real submit handler; do not pre-migrate.

---

## P3 — Earned at a specific trigger (don't pre-build)

| Trigger | Do |
|---|---|
| Backtest engine produces dynamic values | Apply `Lede size="clamp(22px, 2.5vw, 28px)"` to `/backtest` top strip (see `FUTURE_TRIGGERS.md` T1) |
| `/signals` or backtest trade log crosses ~500 rows | `TerminalTable` virtualization (`@tanstack/react-virtual`) + memoized row factory + CSS `:hover` instead of mutating `currentTarget.style` |
| Multi-tab or server-mediated signals arrive | Replace `lib/signal-log-bridge.ts` localStorage dance with BroadcastChannel or server round-trip |
| Any real fetch replaces a static const | Add `<Skeleton />` atom + `<Suspense>` boundaries; loading-state pattern catches up with data-fetching pattern, not ahead of it |
| Long strategy names reach Step 3 heading | `whiteSpace: nowrap; overflow: hidden; text-overflow: ellipsis; title={...}` on `strategies/new:731–743` |
| Help / Support / Contact page ships | Keep it in the same relative order across pages (WCAG 2.2 SC 3.2.6 Consistent Help) |
| Urdu localization considered | Plan RTL before it becomes structural debt — currently every inline-style uses `marginLeft` / `textAlign: "left"` / one-sided paddings |
| A specific user asks for print | Add `@media print` to `globals.css` |

---

## P4 — Deliberate non-actions (looked wrong, aren't)

- **3 runtime deps (next, react, react-dom), zero UI/state/chart libraries.** Keep this. Flagged by every audit as a long-term win, not a gap.
- **Inline-styled architecture.** Cracks are showing (FlashToast × 5, modal scaffolds × 5) but the cost of migrating to CSS modules / vanilla-extract is larger than the cost of extracting small shared primitives. **Reject the "migrate to Tailwind / CSS modules" impulse.** Accept `useStyles()`-style token-based style helpers in `theme.tsx` if the duplication keeps growing.
- **Custom SVG charts (`components/charts.tsx`, 103 LOC).** Zero chart library. Keep this. One `preserveAspectRatio="none"` fix (layout C5) is the only open item.
- **`logo-variants.tsx` (694 LOC)** — only imported by `/brand`. Correctly tree-shaken. **But** move `/brand` behind `NODE_ENV === "development"` or accept that it's a public art gallery (currently it's routable and indexable).
- **Subgrid without fallback** — Baseline Widely Available since 2026-03-15, ~97% support. No action needed.
- **Auth modal "pending" state + "being wired up" banner.** Right pattern. Don't persist a fake token to bypass the banner.
- **`ThemeToggle` re-render on every page** — non-issue; `reactCompiler` will handle it when P1-4 lands.
- **Grids without `minmax(0, 1fr)`** — per-site triage already closed this (see PROJECT_TRACKER Key Decisions 2026-04-24). Do not sweep.
- **Inline arrays in JSX** — non-issue until server-component migration, where they become build-time constants anyway.
- **Flash-toast unmount race warning in React 19** — cosmetic, React 19 silences the warning.

---

## Pattern → bar used in this review

For a recommendation to make P0 or P1, it must:

- Name a specific failure mode (user-visible bug, WCAG SC failure, measurable CWV hit, security exploit path)
- Have a cost proportional to the failure mode (not a rewrite to prevent a typo)
- Not pre-build for a hypothetical future requirement

For a recommendation to make P2 (architecture), it must:

- Be cheaper to decide now than later (because the decision calcifies code)
- Have a concrete trigger event after which the decision crystallizes in real code

For a recommendation to make P3 (triggered), it must:

- Have a specific observable event that flips it from "not needed" to "needed"
- Not be prophylactically beneficial today

This is the same bar the survey + consistency follow-up established. It holds here.

---

## If only 10 fixes land this week

1. P0-1 brand PAD — 1 line
2. P0-2 strategies ID fallback — 1 line
3. P1-3 darken Paper `text3` + switch `primaryLight` for small text — 1 token + grep
4. P1-4 `reactCompiler: true` — 1 line
5. P1-1 security headers — ~30 lines
6. P1-2 prod-gate `allowedDevOrigins` — 3 lines
7. P0-3 `:focus-visible` — 1 `globals.css` rule + strip 4 outlines
8. P1-7 `<Modal>` + `useModal()` extract + apply — ~30 LOC hook, ~8 sites
9. P1-13 theme SSR flash fix — ~10 lines
10. P1-14 slim fonts — 3 lines

Net: fixes 2 real bugs, closes the site-wide WCAG AA contrast hole, enables auto-memoization across the whole codebase, lays the CSP foundation, kills the theme flash, trims ~100 KB from the font payload, consolidates modal hygiene (three reports worth of findings at once). Each item has a specific failure it defends against; each is scoped so the whole batch fits in a single afternoon.

Everything else is earned to wait.
