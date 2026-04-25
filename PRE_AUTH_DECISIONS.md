# Pre-Auth Architecture Decisions

> Captured: 2026-04-25
> Status: Decisions finalized **before** auth + backend wiring. Source: `FRONTEND_REVIEW_2026-04-24.md` P2 bucket.
>
> These decisions calcify the moment real auth/backend code lands. Documenting them up front keeps the cheap choice cheap and the correct choice correct.

---

## ADR-1 · Session tokens live in httpOnly cookies, never `localStorage`

**Status**: Accepted.

**Context**.
Current `localStorage` consumers (`components/theme.tsx`, `app/layout.tsx` themeInit,
`lib/signal-log-bridge.ts`) are non-sensitive — a theme preference and a
cross-page pending-trades bridge. Auth is not wired; no token code exists yet.

When the backend lands, the path of least resistance will be:
`localStorage.setItem("token", ...)`. That is the wrong path. Any XSS (including
from a third-party script) reads `localStorage` freely; cookies with the right
flags are inaccessible to JS.

**Decision**.

1. Session and refresh tokens are stored in cookies set by the server with:
   - `HttpOnly`
   - `Secure`
   - `SameSite=Lax` (use `Strict` only if the final auth flow never redirects back with the cookie — Google OAuth does, so `Lax`)
   - `Path=/`
   - `__Host-` prefix on the session cookie (forces `Secure`, no `Domain`, `Path=/`)
2. **No token value ever hits client-side JS.** The client knows "logged in / not logged in" only from a server-rendered flag or a `/api/me` probe — not from reading the cookie.
3. `localStorage` is reserved for non-sensitive UX preferences. Any new key must be reviewed against this ADR.

**Consequences**.
- Auth SDK choice (NextAuth / Auth.js / Supabase / custom) must respect (1). NextAuth / Auth.js default to httpOnly cookies — good. Supabase defaults to localStorage — require the `storage: cookieStorage` override.
- CSRF becomes a real concern since we're cookie-based. Mitigate with double-submit token or SameSite=Lax + origin check on mutating routes.
- Logout must clear the cookie server-side. A client-side logout that only redirects is insufficient.

**Revisit when**: the first auth integration PR is opened.

---

## ADR-2 · OAuth redirect params are allowlisted

**Status**: Accepted.

**Context**.
`AuthModal` is currently a stub (`handleGoogle` sets status to `pending`). When
the real Google / NextAuth flow lands, the typical `?next=/portfolio` pattern
will be added so users bounce back to where they came from. Unvalidated
redirects are an OWASP Top 10 entry (open-redirect → phishing).

**Decision**.

Any redirect target read from the URL (`next`, `returnTo`, `redirectTo`, `callbackUrl`) must pass this helper before being used as a navigation target:

```ts
// lib/safe-redirect.ts  (target path — implement when first redirect param lands)
export function safeRedirect(raw: string | null, fallback = "/"): string {
  if (!raw) return fallback;
  // Reject protocol-relative (//evil.com), absolute URLs, and non-/ paths.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  // Reject any path that parses to a different origin (belt + suspenders).
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
```

Server side (for redirect after POST-back from OAuth provider), reject anything
that isn't a same-origin path; log the rejection.

**Consequences**.
- One helper. Every redirect site uses it. No ad-hoc `router.push(searchParams.get("next") ?? "/")`.
- When Auth.js / NextAuth is wired, its `callbackUrl` validator uses the same allowlist (NextAuth calls this `callbacks.redirect` — the default is permissive; override it).

**Revisit when**: the first `searchParams.get("next")` / `callbackUrl` is added to the codebase.

---

## ADR-3 · Action buttons are tiered by blast radius

**Status**: Accepted (modified from P2 review — 4 tiers, not 3).

**Context**.
Today every action — `Deploy`, `Launch bot`, `Pause/Resume`, `Delete` — is a
single-click `setState` flip. Verified sites:
- `app/backtest/page.tsx:98` — `handleDeploy` (flip)
- `app/strategies/[id]/page.tsx:90` — `handleDeploy` (flip)
- `app/bots/[id]/page.tsx:52` — `handlePauseToggle` (flip)
- `app/bots/page.tsx:74` — `handlePauseAll` (flip + toast)

When these wire to real endpoints, the UX must make blast radius visible.
A one-click `Deploy →` that actually streams money through a live account is
a footgun.

**Decision** — four tiers:

| Tier | Example | UX | Server side |
|---|---|---|---|
| **T0 · Read-only** | Sort table, filter signals, toggle chart zoom | 1-click, no feedback | No write — rate-limit not required |
| **T1 · Paper / reversible** | Save strategy draft, pause paper bot, deploy to signal feed (paper) | 1-click + toast (`FlashToast`) | Idempotent endpoint, rate-limit per user (e.g. 10/min) |
| **T2 · Live / recoverable** | Deploy strategy live, launch live bot, change stop-loss on live position | Confirmation modal (type strategy / bot name to confirm) + toast | Rate-limit (e.g. 5/min), audit log, session freshness ≤ 30 min |
| **T3 · Destructive / irreversible** | Delete strategy (with history), revoke API key, close account | Confirmation modal + type exact name + **re-authentication** (re-enter Google / fresh SSO) | Rate-limit (e.g. 1/min), audit log, session freshness = now, email notification |

**Implementation notes when triggered**.
- Use the existing `<Modal>` atom from `components/atoms.tsx` for T2 / T3 confirmations.
- Re-auth for T3: open `AuthModal` in "re-verify" mode; the backend requires a fresh token before it accepts the mutation.
- The `variant="deploy"` button already visually separates T2-candidates from T1; keep the distinction.

**Consequences**.
- Every new action must be explicitly placed in a tier (PR reviewers enforce).
- Mass-action endpoints (`Pause all`) inherit the tier of their most-severe target — if any live bot is included, treat as T2.

**Revisit when**: the first action button wires to a real server mutation.

---

## ADR-4 · `NEXT_PUBLIC_*` cannot contain `SECRET` / `KEY` / `TOKEN` / `PASSWORD`

**Status**: Accepted.

**Context**.
Next.js inlines every `NEXT_PUBLIC_*` env var into the client bundle at build
time. A `NEXT_PUBLIC_STRIPE_SECRET_KEY` or `NEXT_PUBLIC_JWT_SECRET` is a
published secret — irreversibly leaked the moment the build ships.

The project has zero `NEXT_PUBLIC_*` usage today and no `.env*` files in repo.
The first one added is the dangerous moment.

**Decision**.

Build-time check via `scripts/check-env.mjs`, wired to `prebuild`. The check
scans `.env`, `.env.*`, and source files for any `NEXT_PUBLIC_<name>` where
`<name>` contains (case-insensitive) `SECRET`, `KEY`, `TOKEN`, `PASSWORD`,
`PRIVATE`, `CREDENTIAL`. A match fails the build with a list of offenders.

Exceptions that legitimately include `KEY` (e.g. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe publishable keys are safe): allowlist by exact match in the script, not by pattern.

**Why not ESLint?** The project intentionally has no ESLint config and 3 runtime
deps. Adding ESLint + `eslint-plugin-next` + config for one rule is overhead
this project deliberately avoids. A 30-line Node script is cheaper and
reviewable at a glance.

**Consequences**.
- `prebuild` runs on every CI build. Local `next dev` bypass is acceptable (the leak only matters at build).
- Adding a new publishable / public identifier requires an explicit allowlist entry — forces the author to think about it.

**Implemented**: yes — `app/scripts/check-env.mjs` (this session).

---

## ADR-5 · Analytics data capture policy

**Status**: Accepted.

**Context**.
No Sentry, PostHog, Plausible, or similar wired today (verified: zero deps,
zero imports). When one is added, its default behaviour is to capture:
- Form input values (Sentry breadcrumbs) — trade symbols, quantities, prices.
- URL paths including query strings — potentially `/portfolio?sym=AAPL&qty=100`.
- Session replays — literal videos of the user's screen.
- Click targets including `textContent` — order buttons with embedded symbol / amount.

For a trading app, any of those is a privacy / compliance incident.

**Decision** — baseline configuration for whichever SDK is chosen:

1. **Scrub form values**. Sentry: `beforeBreadcrumb` with `category === "ui.input"` → drop `event.target.value`. PostHog: mask all inputs with `session_recording.maskAllInputs: true`.
2. **Scrub trade-field breadcrumbs**. Any event whose message / data includes keys matching `sym`, `qty`, `entry`, `exit`, `stop`, `target`, `pnl`, `price`, `amount` has those keys redacted in `beforeSend`.
3. **No session replay on financial routes**. Disable replay sampling for `/portfolio/*`, `/strategies/*`, `/bots/*`, `/backtest/*`, `/signals/*`. Keep it (if enabled at all) only for marketing pages.
4. **No cookie / `localStorage` capture** in breadcrumbs. Sentry: `attachStacktrace: false` in tests; in prod, set `denyUrls` and custom integrations to filter `storage` breadcrumbs.
5. **User identification via opaque ID only**. No email in Sentry user context. If the auth layer produces `userId: "usr_abc123"`, that's what gets attached. Email / name stay server-side.
6. **Source-map upload, but no source inclusion** in public error endpoint. Sentry's `authToken` goes through CI only.

**Consequences**.
- PR that adds Sentry / PostHog must include the scrubbing config in the first commit, not a follow-up.
- Compliance review (if we ever pursue one) has an explicit pointer to what we capture and don't.

**Revisit when**: any error-tracking or analytics SDK is added to `package.json`.

---

## ADR-6 · CSS-variable escape valve for `useT()` (marketing pages → server components later)

**Status**: Accepted. Escape valve **implemented this session**. Marketing-page migration **deferred** until a triggering event (PPR measurement or `cacheComponents: true` rollout).

**Context**.
Every `app/**/page.tsx` is `"use client"`. `useT()` is used 115 times across
20 files. This means no page can benefit from Next.js partial prerendering,
`cacheComponents`, or `unstable_instant` — all of which require the page tree
to be mostly server-rendered.

The blocking factor is tokens: `useT()` only works in client components.
Server components need a parallel way to reach the same colors / fonts.

**Decision**.

1. **Escape valve (shipped today, zero regression)**: `components/theme.tsx` and the `themeInit` blocking script in `app/layout.tsx` now write CSS custom properties on `<html>` (`--surface`, `--text`, `--text2`, `--text3`, `--primary`, `--primary-light`, `--gain`, `--loss`, `--outline`, `--outline-variant`, `--outline-faint`, plus surface variants). Paper is the default in `:root`; Amber overrides via `[data-theme="dark"]`. The root `data-theme` attribute is set synchronously (before first paint) by the themeInit script.
2. **Server components can now read**: `background: var(--surface)`, `color: var(--text)`, etc., directly in inline styles without touching `useT()`.
3. **Migration is deferred**. `useT()` call sites are *not* mass-rewritten. The first page to benefit (e.g. `/pricing`) gets converted when a reason exists (measurable PPR win, or marketing SEO becomes important). Client components keep using `useT()` — no churn.

**What the migration will look like** (record for future-us):

1. Pick a marketing-ish page (`app/pricing/page.tsx` is the best first candidate — mostly static, few dynamic parts).
2. Strip `"use client"`. `useT()` calls become `var(--xxx)` in inline styles.
3. Any remaining interactive bits (ThemeToggle is already client; scroll-to buttons) become named client components extracted into `components/*.tsx`.
4. Run the page. Verify it renders correctly in both modes without hydration warnings.
5. Measure. If PPR / cacheComponents show a real win, migrate the next page.

**Consequences**.
- Client components keep working unchanged.
- Server components gain a reliable path to tokens.
- Theme changes propagate to both via CSS cascade — no divergence.

**Implemented**: yes — `app/components/theme.tsx`, `app/app/layout.tsx`, `app/app/globals.css` (this session).

**Revisit for migration when**: we start measuring Core Web Vitals in prod, or when Next's `cacheComponents: true` stabilizes on our version, or when marketing / SEO becomes a priority.

---

## ADR-7 · NextAuth v5 chosen over hand-rolled OAuth

**Status**: Accepted (2026-04-25 — implemented same session).

**Context**.
Backend wiring needed an auth solution for Google sign-in. Two paths existed:
hand-roll the OAuth dance + cookie issuance (~150 lines), or adopt NextAuth v5
(adds one runtime dep). The 3-runtime-dep purity (`next`, `react`, `react-dom`)
is real and the bar to cross it is high.

Two facts forced NextAuth: (1) the FastAPI backend at
`psxDataPortal/backend/app/core/auth.py` already verifies NextAuth-issued JWTs
(HS256 with `NEXTAUTH_SECRET`) and the cloud Neon DB has live user rows keyed
off NextAuth's `account.providerAccountId → token.user_id` mapping —
hand-rolling would require parallel changes on the backend and risk orphaning
existing accounts; (2) the previous frontend (`psx-trading-view/auth.ts`) is a
proven 34-line integration with the exact mapping the backend expects.

**Decision**.

1. Add `next-auth@5.0.0-beta.31` (pinned, exact version) as the only new
   runtime dep in this migration.
2. Port `psx-trading-view/auth.ts` verbatim — same Google provider, same
   `providerAccountId → user_id` mapping. The only adjustment is `pages.signIn`,
   which points to `/?auth=required` because psx-ui has no dedicated `/login`
   route (the AuthModal opens on the landing page instead).
3. The 3-dep-purity bar applies to **UI bloat** (Tailwind, shadcn, Radix, SWR);
   auth infra is a deliberate exception, recorded here so it does not turn into
   a precedent.

**Consequences**.
- NextAuth's defaults satisfy ADR-1 (httpOnly + Secure + SameSite=Lax cookies).
- NextAuth's `callbacks.redirect` will be the implementation point for ADR-2's
  same-origin allowlist when the first `callbackUrl` flow lands.
- Future auth providers (Apple ID, magic link) plug into the same `auth.ts`
  with no architectural change.

**Implemented**: yes — `app/auth.ts`, `app/app/api/auth/[...nextauth]/route.ts`,
`app/proxy.ts` (this session — `proxy.ts` is the Next.js 16 file-convention
rename of `middleware.ts`).

---

## ADR-8 · `/strategies` list ships without per-row enrichment (signals / latest backtest)

**Status**: Accepted (2026-04-26 — implemented same session, Phase 3.2 list slice).

**Context**.
The `/strategies` list-page UI (`app/strategies/strategies-view.tsx`) declares a
row shape that includes:

- `signals` — count of signals fired today by the strategy
- `bt` — latest backtest's total return (e.g. `"+14.2%"`)
- `sharpe` — latest backtest's Sharpe ratio
- `outputs` — array of `bt`/`sig`/`bot` glyphs indicating which downstream
  surfaces the strategy is bound to

None of these fields are on the bare `StrategyResponse` returned by
`GET /strategies` (`backend/app/schemas/strategy.py:211`). Sourcing them
correctly requires:

- one `GET /strategy-signals?strategy_id={id}&date=today` per row, **or** a new
  list-summary endpoint
- one `GET /strategies/{id}/backtests?limit=1` per row, **or** the same
- bot-binding lookup (which strategies have an active bot bound) — currently
  derivable only by joining the `bots` table

For a list of N strategies that's 2N+1 round trips for first paint of a page
that's the *index* of the user's authoring work — i.e. the most-visited
authenticated route besides `/signals`.

**Decision**.

1. **List page ships with empty sentinels.** Mapping in
   `app/strategies/page.tsx` sets `signals: 0`, `bt: "—"`, `sharpe: null`,
   `outputs: []` for every row. The UI already renders these as "no data"
   states (greyed `—`, dim "today" count) — no markup change required, no
   shouting `null`s in the user's face.
2. **`type` is hardcoded to `"Custom"`.** The frontend's `Mean reversion` /
   `Momentum` / `Trend follow` taxonomy is a presentation taxonomy that does
   not exist as a backend field. Deriving it from `entry_rules.conditions[].indicator`
   would couple the frontend taxonomy to the indicator enum and be wrong about
   half the time (a strategy can use both RSI and SMA indicators and not be
   cleanly any single category). `"Custom"` is honest; a real classifier
   belongs to the strategy author, not the renderer.
3. **`universe` is derived locally.** From `stock_symbols` if non-empty
   (`"PSO, OGDC"` for ≤2, `"N symbols"` otherwise), else from
   `stock_filters.sectors` if present, else fallback to `"KSE-100"`. Cheap,
   no extra fetch.
4. **The existing JSON-import flow stays in-memory only.** `coerceStrategy()`
   reads imported records into client state; nothing POSTs to the backend.
   Real persistence arrives with the wizard (Phase 3.2 follow-up) which uses
   `POST /strategies` directly.

**Consequences**.
- Page renders in 1 round trip instead of 2N+1. Predictable LCP.
- Users with many strategies lose at-a-glance signal counts and recent BT
  performance — the loss is real but measured: this data is one click away on
  the strategy editor page (`/strategies/[id]`) which fetches the full record
  + can fetch backtest history when needed.
- Sorting by `backtest`, `sharpe`, `today` (signals today) all become no-ops
  while the columns are placeholders. Sort UI stays — removing it would be a
  markup change. The columns still work after enrichment ships.

**When to lift the deferral**.

Either of these triggers the unit of work labeled "Phase 3.2 enrichment":

1. A user with ≥10 strategies reports the empty `bt` / `sharpe` columns as a
   real workflow problem (the bar is feedback, not aesthetics).
2. The backend grows a `GET /strategies?include=summary` (or equivalent) that
   returns the enriched fields in a single query — at which point the cost
   collapses to one round trip and the deferral is free to lift.

**Implemented**: yes — list page wired, fields default to sentinels — this session.

---

## ADR-9 · Phase 3.2b–3.5 ship safe-write paths only; complex round-trips deferred

**Status**: Accepted (2026-04-26 — implemented same session as 3.2a/b/c, 3.3, 3.4, 3.5).

**Context**.
Phase 3 wired five remaining routes (`/strategies/new` wizard, `/strategies/[id]`
editor, `/bots` list/wizard/dashboard, `/portfolio`, `/backtest`) in one stretch.
Each had write paths whose full bidirectional fidelity would have required
either schema work, UX clarification, or per-row enrichment endpoints that
don't exist yet. To keep the migration moving without shipping broken
round-trips, each route ships **safe** writes and defers the dangerous ones.

**Decision** — five concrete deferrals, one per route:

1. **Wizard preset → `entry_rules` mapping is starter conditions, not faithful**.
   `app/strategies/new/page.tsx`'s `presetToEntryRules()` maps each preset
   (mean reversion, momentum, golden cross, etc.) to the *simplest possible*
   condition the backend's indicator vocabulary allows. The preset's
   `baseRule` text (e.g. "Volume > 1.5× avg") describes the spirit; the
   posted condition (e.g. RSI(14) < 30) is the realization. Users are
   expected to refine in the editor afterwards. This is documented inline.
   **Lifts when**: the backend grows custom-indicator support, or the wizard
   gains a "review the conditions" preview step.

2. **Editor condition canvas does not round-trip**.
   `app/strategies/[id]/editor-view.tsx` reads `initialStrategy` and renders
   the existing visual canvas in **display only**. The Save Draft button
   reports "Draft saved (local)" — the canvas state is *not* serialized to
   `entry_rules.conditions`. Only the deploy/pause toggle is real (PUTs
   `{status: ACTIVE|PAUSED}`). Persisting the canvas requires a node-tree
   serializer that maps the editor's internal model to the backend's nested
   `ConditionGroup{logic, conditions[]}` shape — a session of careful work
   on its own.
   **Lifts when**: a dedicated session designs and tests the
   canvas↔ConditionGroup serializer with round-trip equality tests.

3. **Bot dashboard activity log is empty-state only**.
   The backend exposes positions, trades, and performance snapshots — but no
   per-bot scan/decision log. The Logs modal renders a "coming soon" notice
   instead of fake entries; the inline "recent activity" panel renders an
   empty-state.
   **Lifts when**: a `GET /bots/{id}/logs` endpoint is added (or trades are
   reframed as the activity feed).

4. **Bot list `today` (daily P&L) is always 0**.
   `daily_pnl` is on `BotDetailResponse` only, not the list `BotResponse`. The
   list shows 0 / "—" for the today column; the per-bot dashboard reads the
   real value. Same trade-off as ADR-8 (per-row enrichment cost) and the
   same lifting trigger.

5. **Portfolio backend semantics differ from the journal UI; full wiring deferred**.
   The backend's `/portfolio` is a paper-trading account (place market
   orders, executes against latest price). The frontend's `/portfolio` page
   is currently a *journal* (log trades you made elsewhere, kept in local
   CSV via `lib/portfolio-csv.ts`). Wiring naively would change product
   semantics. This session ships:
   - `lib/api/portfolio.ts` (full type surface + wrappers)
   - `/api/portfolio/{orders, reset, add-funds}` route handlers
   - **No page-level changes** — the journal UI keeps using local state.
   **Lifts when**: product decides whether `/portfolio` is the journal, the
   paper-trading account, or both with clear UI separation.

6. **Backtest "Re-run" uses an opinionated 12-month range and 1M PKR capital**.
   The existing UI has no date pickers or capital input — the wired Re-run
   button picks "today minus 1 year → today" and `initial_capital = 1_000_000`
   (or carries forward the loaded result's value). Polling lasts ~45 seconds
   (30 attempts × 1.5s) and gives up rather than hanging. A range/capital
   form belongs to a follow-up.
   **Lifts when**: the UI grows a backtest-config form (date range +
   capital + universe override).

**Why this is acceptable**.
- Every deferral is documented at its call site **and** here, with a concrete
  trigger to lift it.
- No deferral leaves the user with broken behavior — each route either does
  the safe thing (read + simple write) or shows an empty-state with a
  truthful "coming soon" message. There are no fake entries dressed up as
  real data.
- The full type + route surface ships in this session, so follow-up slices
  don't re-derive the contract. They just fill in the deferred behavior.

**Implemented**: yes — Phases 3.2b/c, 3.3, 3.4 (API surface only), 3.5 — this session.

---

## Deferred (no ADR, captured for completeness)

- **`useActionState` / `useFormStatus` / `useOptimistic` for wizards**. The `strategies/new` and `bots/new` wizards currently use `onClick` + step state, not `<form>` / `onSubmit`. React 19's form primitives only help when an async server action backs the submit. **Revisit when** the first wizard step wires to a real `action` — at that moment, migrate the whole wizard (not incrementally).
- **Strategies wizard (`/strategies/new`) and editor (`/strategies/[id]`) wiring**. Phase 3.2 sub-tasks. The wizard needs a `POST /strategies` round trip on final submit; the editor needs the full read/write loop including a careful round-trip of the visual condition canvas to/from the backend's `EntryRules.conditions.{logic, conditions[]}` JSON. **Revisit when**: list slice is verified end-to-end with real user data and the editor's serialization shape is mapped.

---

## Cross-references

- `FRONTEND_REVIEW_2026-04-24.md` — source of these P2 items (§ "P2 — Pre-empt-before-auth architecture")
- `PROJECT_TRACKER.md` — live project status
- `FUTURE_TRIGGERS.md` — P3 signal→action registry (sibling bucket)
