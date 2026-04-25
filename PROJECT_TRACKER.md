# Project Tracker

> Last updated: 2026-04-25 (Backend wiring plan written — Phase 1 starting)

## Project Summary
PSX Algos — marketing site + in-app experience for a no-code strategy authoring, backtesting, and paper-trading product for the Pakistan Stock Exchange. Next.js 16 App Router, inline-style React UI.

## Current Status
**Status**: Active — backend wiring in progress

## In Progress
- [ ] **Backend wiring — Phase 1: Auth (NextAuth v5 / Google)** — `BACKEND_WIRING_PLAN.md` is the source of truth. Scope: psx-ui's existing 7 routes + landing get wired to the existing FastAPI backend at `psxDataPortal/backend/`. **No new UI work, no new routes, no new features.** Repo Option A (psx-ui stays separate, talks to backend over HTTPS). NextAuth chosen because backend already verifies its JWTs (`backend/app/core/auth.py:1`). Phase 1 deliverable: clicking Continue with Google produces a real session cookie; no data fetching yet. Then Phase 2 (`/signals` spike) → Phase 3 (5 routes, one PR each) → Phase 4 (Vercel cutover).

## Recently Completed
- [x] Repo cleanup — removed ephemeral PNGs, `.playwright-mcp/`, 5 angle-review reports, closed survey/followup docs, and pre-app design scaffolds. Repo root now: `PROJECT_TRACKER.md`, `FRONTEND_REVIEW_2026-04-24.md`, `PRE_AUTH_DECISIONS.md`, `FUTURE_TRIGGERS.md`, `app/` — (2026-04-25)
- [x] P3 trigger registry — 8 earned-at-signal items at `FUTURE_TRIGGERS.md` (Lede clamping, TerminalTable virtualization, signal-log-bridge retirement, real-fetch loading states, Step 3 name truncation, Help nav placement, RTL audit, print stylesheet). Trigger fires → entry moves here, deleted from registry — (2026-04-25)
- [x] P2 bucket — 6 ADRs at `PRE_AUTH_DECISIONS.md` (session tokens, OAuth redirect allowlist, action-tier blast radius, env-leak rule, analytics scrub, CSS-var escape valve). Two implementations shipped: `app/scripts/check-env.mjs` wired to prebuild; `app/globals.css` `:root` + `[data-theme]` token system. ADR-7 (form primitives) deferred — wizards use `onClick`, not `<form>` — (2026-04-25)
- [x] P1 bucket — 18 of 20 applied: security headers (CSP deferred to auth), prod-gated `allowedDevOrigins`, `reactCompiler: true`, contrast fixes (Paper text3/primaryLight), SSR theme-flash eliminated, mobile-first `useSyncExternalStore` breakpoint, `<Modal>` + `<FlashToast>` primitives swapped at 10 sites, portfolio CSV extracted to `lib/portfolio-csv.ts`, a11y micro-fixes (`100dvh`, `aria-hidden` SVG sweep, target-size bumps, semantic landmarks + skip-link). P1-16 hamburger threshold rejected; P1-17 Lede overflow deferred to P3 — (2026-04-25)
- [x] P0 bucket — 6 bugs fixed: `/brand` `PAD[bp]` TS error; strategies import dedup (no more `Math.random()` IDs); site-wide `:focus-visible`; canvas-node keyboard activation in `strategies/[id]`; portfolio CSV reads from real positions (not `forceEmpty`-gated); bots stale-closure on `runningCount` — (2026-04-24)
- [x] 5-agent frontend review — parallel code-quality / a11y / perf / security / layout audits consolidated to `FRONTEND_REVIEW_2026-04-24.md` with P0–P4 bucket synthesis. Predicted Web Vitals: LCP 1.8–2.6s, CLS 0.05–0.15 — (2026-04-24)
- [x] Frontend survey + consistency followup work — 8 survey fixes (`/pricing` mobile stack, `/bots/new` fluid sizing, `/bots/[id]` Lede clamp, `/signals` nowrap default, `/backtest` subgrid, ordinal-span hardening) + 4 followup items (portfolio Allocation-by-sector subgrid, `/portfolio` Lede strip clamped, prophylactic grid sweep deferred per evidence-bar rule). Established patterns now codified in `FUTURE_TRIGGERS.md` — (2026-04-24)
- [x] Google-only auth modal wired to marketing nav (`components/auth-modal.tsx` + `MarketingNav`) — single-step modal, theme-inverted Google button for max contrast, ESC + click-outside + focus scope + body scroll-lock + `psx-fade-in`/`psx-pop-in` animations. Pending state until OAuth backend lands — (2026-04-24)
- [x] Final logo system — α-signed mark with node-graph signature ("V20"); single SVG flips colors via `T.primary`/`T.surface` per theme; full icon resolution set (favicons, apple-touch, maskable 192/512); PWA manifest at `public/manifest.webmanifest`; favicon `<link>` retargets at runtime to track site theme (not OS preference); internal `/brand` lab catalogs 25 explored variants — (2026-04-23)
- [x] Site-wide responsive support — `useBreakpoint` (640 / 1024 tokens) in `components/responsive.tsx`, hamburger drawer for marketing + app navs, mobile card-view for all 7 data tables in `TerminalTable`, Pointer-Events-driven pan + pinch-zoom on the strategy editor canvas, hardened `globals.css` (overflow, iOS auto-zoom guard, `prefers-reduced-motion`). Verified across 11 routes × 4 viewports — (2026-04-22)

## Blockers
- None

## Key Decisions
- (2026-04-25) **Pre-auth architecture documented as ADRs at `PRE_AUTH_DECISIONS.md`** (6 ADRs). Two have code shipped today; the other four fire when their trigger event arrives. Rationale: cost of writing 6 ADRs now ≈ 20 min; cost of reversing wrong choices later = migration work, security incidents, compliance review.
- (2026-04-25) **No ESLint in the project** — the `NEXT_PUBLIC_` leak guard is a 150-line `scripts/check-env.mjs` wired to `prebuild`, not an ESLint rule. Project ships 3 runtime + 5 dev deps and deliberately has no linter; a deps-free Node script catches the same class of bugs at the same lifecycle point.
- (2026-04-24) **Auth is Google-only, single flow, modal (no dedicated route)**. One "Continue with Google" button creates account if new, signs in if returning. Modal over the marketing site keeps landing context intact and avoids a sparse auth page round-trip. Apple ID / magic-link can be added later if analytics demand it.
- (2026-04-23) **Final logo: α with node-graph signature ("V20 α signed")**. α is name-rooted ("a" of Algos), finance-rooted (alpha = excess return), and the node signature preserves the visual-strategy-editor story. No competitor (KTrade, Sarmaaya, Finqalab, QuantConnect, Composer) uses α — uncontested category real estate.
- (2026-04-23) **Single mark, theme-reactive fills** (not two separate logos). The app is already runtime-themed via `useT()`, so the logo joins the same token system — geometry is the identity, colors come from `T.primary`/`T.surface` and flip automatically.
- (2026-04-22) **Responsive breakpoints fixed at 640 / 1024**. Marketing nav doesn't fit below 1024, app nav is data-dense; both switch to hamburger at the same threshold so behavior is consistent.
- (2026-04-22) **Runtime `useBreakpoint` over CSS media queries**. Codebase is entirely inline-style React — a hook fits the existing idiom and lets conditional rendering share the same breakpoint logic as layout.
- (2026-04-22) **Card view on mobile for all data tables, desktop table unchanged**. NN/g consensus: comparison/record-list tables on mobile should become cards. Implementation lives inside `TerminalTable`, so per-page changes are 1–3 flag additions on existing `cols` arrays.

## Notes
- App lives at `/app/`; this tracker and source repo root are at `/media/shared/personalProjects/psx-ui/`.
- Next.js version: 16.2.4. See `app/AGENTS.md` — some APIs may differ from older docs; consult `app/node_modules/next/dist/docs/` before touching framework-level code.
