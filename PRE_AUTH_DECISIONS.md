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

## Deferred (no ADR, captured for completeness)

- **`useActionState` / `useFormStatus` / `useOptimistic` for wizards**. The `strategies/new` and `bots/new` wizards currently use `onClick` + step state, not `<form>` / `onSubmit`. React 19's form primitives only help when an async server action backs the submit. **Revisit when** the first wizard step wires to a real `action` — at that moment, migrate the whole wizard (not incrementally).

---

## Cross-references

- `FRONTEND_REVIEW_2026-04-24.md` — source of these P2 items (§ "P2 — Pre-empt-before-auth architecture")
- `PROJECT_TRACKER.md` — live project status
- `FUTURE_TRIGGERS.md` — P3 signal→action registry (sibling bucket)
