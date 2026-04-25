# Backend Wiring Plan

> Created: 2026-04-25
> Status: Active — Phase 1 starting
> Scope: Wire psx-ui's existing 7 routes + landing to the existing FastAPI backend at `psxDataPortal/backend/`. **No new UI work, no new routes, no new features.**

---

## Decision Anchors (do not relitigate mid-migration)

1. **Repo layout — Option A.** psx-ui stays at `/media/shared/personalProjects/psx-ui/`. Backend stays at `/media/shared/personalProjects/psxDataPortal/backend/`. Frontend talks to backend over HTTPS (Railway). Two repos, two deploys, fully decoupled.
2. **Auth — NextAuth v5 (beta), Google provider only.** Reasons:
   - Backend already verifies NextAuth-signed JWTs (`backend/app/core/auth.py:1` — HS256 with `NEXTAUTH_SECRET`). Hand-rolling OAuth would require rewriting backend auth.
   - Previous frontend's `auth.ts` is 34 lines; the integration is small and proven.
   - NextAuth defaults (httpOnly + Secure + SameSite=Lax) implement ADR-1; they don't violate it.
   - The "3 deps" purity in psx-ui targets UI bloat (Radix/shadcn/Tailwind/SWR), not auth infra. Adding `next-auth` is a deliberate exception, recorded as a new ADR.
3. **`psx-trading-view/` is being retired.** No code is being copied wholesale; specific files (auth.ts, API client patterns, env names) are referenced as starting points only. The 9 routes that exist there but not in psx-ui (admin, alerts, chart, checkout, editor, market, screener, settings, watchlists) are **out of scope** — they are not being ported.
4. **No new UI dependencies.** psx-ui's package.json gains exactly one entry: `next-auth`. Anything else needs an explicit decision.
5. **The existing AuthModal stub keeps its UI.** The Google button calls `signIn("google")` instead of the `pending` placeholder. No visual change.

---

## Route → Backend Endpoint Map

| Route | Auth? | Endpoints consumed |
|---|---|---|
| `/` (landing) | public | none |
| `/pricing` | public | `GET /subscriptions/plans` |
| `/brand` | public | none (internal showcase) |
| `/signals` | gated | `GET /signals`, `GET /signals/top-opportunities`, `GET /signals/summary`, `GET /signals/{symbol}` |
| `/strategies` | gated | `GET/POST /strategies`, `GET/PUT/DELETE /strategies/{id}` |
| `/strategies/[id]` (editor) | gated | `GET /strategies/{id}`, `PUT /strategies/{id}`, `GET /strategies/meta/indicators`, `GET /strategies/meta/data-range` |
| `/strategies/new` (wizard) | gated | `POST /strategies` |
| `/backtest` | gated | `POST /strategies/{id}/backtest`, `GET /strategies/{id}/backtest/job/{job_id}`, `GET /strategies/{id}/backtests`, `GET /strategies/{id}/backtests/{backtest_id}` |
| `/bots` | gated | `GET /bots` |
| `/bots/new` | gated | `POST /bots` |
| `/bots/[id]` | gated | `GET /bots/{id}`, `PUT /bots/{id}`, `DELETE /bots/{id}`, `POST /bots/{id}/{start\|pause\|stop}`, `GET /bots/{id}/{positions\|trades\|performance}` |
| `/portfolio` | gated | `GET /portfolio/{summary\|orders\|trades}`, `POST /portfolio/{orders\|reset\|add-funds}`. Local CSV import/export via `lib/portfolio-csv.ts` stays — only orders go to the API. |

**Public vs gated split** drives `proxy.ts` (Next.js 16 file-convention rename of the old `middleware.ts`): public routes pass through, gated routes redirect to `/` with the AuthModal opened (or 401 if it's an SSR fetch).

---

## Phases

### Phase 1 — Auth wiring only (no route changes)

**Deliverable**: clicking the Google button in `AuthModal` produces a real Google login, sets a NextAuth session cookie, and redirects back to wherever the user was. No data fetching yet.

Steps:
1. `cd app && npm i next-auth@beta` (track `psx-trading-view`'s `5.0.0-beta.30` line; pin exact version once installed).
2. Create `app/auth.ts` — port `psx-trading-view/auth.ts:1-34` verbatim. Same Google provider, same `account.providerAccountId → token.user_id` mapping (critical: existing user rows in the cloud Neon DB key off this; changing the mapping creates orphan accounts).
3. Create `app/app/api/auth/[...nextauth]/route.ts` — exports `handlers.GET, handlers.POST` from `auth.ts`.
4. Edit `components/auth-modal.tsx` — Google button `onClick` calls `signIn("google", { callbackUrl: window.location.pathname })`. Drop the `pending` placeholder branch entirely (it's no longer reachable).
5. Add `proxy.ts` at `app/proxy.ts` — gates `/signals`, `/strategies`, `/backtest`, `/bots`, `/portfolio` (and their subpaths). Unauthenticated requests redirect to `/?auth=required` so the landing page can auto-open the AuthModal. Public: `/`, `/pricing`, `/brand`, `/api/auth/*`.
6. Add `app/.env.example` documenting required env vars: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_API_BASE_URL`. Verify `scripts/check-env.mjs` passes (none of these match the SECRET/TOKEN/PASSWORD regex on the `NEXT_PUBLIC_*` side).
7. Add ADR-7 to `PRE_AUTH_DECISIONS.md`: NextAuth chosen over hand-rolled OAuth. One paragraph.
8. Update `PROJECT_TRACKER.md` — move "Backend wiring Phase 1" to Recently Completed when this phase lands.
9. **Verify before declaring done**: load Google credentials into a local `.env.local`, run `npm run dev`, click "Continue with Google" from the landing page, complete the OAuth flow, confirm the session cookie is set with `HttpOnly`, `Secure` (in prod), `SameSite=Lax`. Confirm `await auth()` returns the user in a server component.

**Out of scope for Phase 1**: any data fetching, any route gating beyond middleware, any `/api/me` probe, any logout UI. The Phase 1 success signal is "I can sign in and the cookie exists."

### Phase 2 — `/signals` end-to-end (the spike)

**Deliverable**: `/signals` shows real backend data instead of the local mock. Every other route untouched.

Steps:
1. Create `app/lib/api/client.ts` — single `apiFetch<T>(path, init?)` function. Reads JWT from NextAuth session (server-side via `auth()`, client-side via passing the token from a server component or via a session-scoped cookie probe). Forwards as `Authorization: Bearer <jwt>`. Base URL = `process.env.NEXT_PUBLIC_API_BASE_URL`. Throws typed errors on non-2xx.
2. Create `app/lib/api/signals.ts` — three typed wrappers: `getSignals()`, `getTopOpportunities()`, `getSignalsSummary()`. Types match `backend/app/schemas/` Pydantic shapes — generate by hand from the schemas, no codegen tool.
3. Edit `app/app/signals/page.tsx` — replace local mock data with the API calls. Decide SSR vs client at this point based on what the page actually does (likely server component for initial fetch + small client island for any interactivity). Keep all existing inline-style markup unchanged.
4. Add small loading + error states matching the existing inline-style idiom. **No SWR.** A plain `<Suspense>` boundary or a tiny `useEffect`+`useState` pair, depending on SSR vs client decision.
5. Test: signed-in user sees their real signals; signed-out user sees the AuthModal (middleware redirect from Phase 1 catches this).
6. Update `PROJECT_TRACKER.md`.

### Phase 3 — Remaining 5 routes

One route per PR. Order from lowest blast radius to highest:

1. **`/pricing`** — public, single `GET /subscriptions/plans` call. Trivial.
2. **`/strategies` (list + wizard)** — full CRUD but no derived state.
3. **`/bots` (list + dashboard + wizard)** — CRUD + lifecycle actions (start/pause/stop). Confirm action confirmation UI matches ADR-3's tier classification (paper-trade actions = T2).
4. **`/portfolio`** — preserves local CSV import/export; only orders/reset/add-funds hit the API.
5. **`/backtest`** — most complex (job-pending → poll → result). Phase 3's load-bearing route.

Each PR follows the same pattern: add `lib/api/{route}.ts`, edit the page(s) to call it, keep markup unchanged, update tracker.

### Phase 4 — Cutover

1. Vercel project for psx-ui (separate from psx-trading-view's Vercel project).
2. Set production env vars: `NEXTAUTH_URL=https://<new-domain>`, `NEXTAUTH_SECRET` (must match the backend's `NEXTAUTH_SECRET` exactly), `GOOGLE_CLIENT_ID/SECRET` (with the new domain in Google Console's authorized redirect URIs), `NEXT_PUBLIC_API_BASE_URL=https://<railway-app>`.
3. Add the new origin to backend's `CORS_ORIGINS` env (currently `127.0.0.1:8000`-style for local; production needs the Vercel domain).
4. DNS cutover. Old `psx-trading-view.vercel.app` → 301 to new domain (configure in Vercel).
5. Decommission the old Vercel project after one week of clean error logs.

---

## What's NOT in this plan (deliberately)

- Porting any of the 9 dropped routes (admin, alerts, chart, checkout, editor, market, screener, settings, watchlists).
- Adding SWR, Tailwind, shadcn, Radix, Sentry, or anything else from `psx-trading-view`'s 60-dep tree.
- Refactoring psx-ui's component organization, theming, or layout.
- Touching the backend.
- Writing a `/api/me` route, a `useSession()` hook beyond what NextAuth provides, or any custom token plumbing.
- Adding tests in this migration. psx-ui has no test suite and adding one is its own project.

---

## Files this migration will touch

Per phase, in dependency order:

**Phase 1 (auth)**:
- NEW `app/auth.ts`
- NEW `app/app/api/auth/[...nextauth]/route.ts`
- NEW `app/proxy.ts`
- NEW `app/.env.example`
- EDIT `app/components/auth-modal.tsx` (drop `pending` branch, wire `signIn`)
- EDIT `app/package.json` (add `next-auth`)
- EDIT `PRE_AUTH_DECISIONS.md` (add ADR-7)
- EDIT `PROJECT_TRACKER.md`

**Phase 2 (`/signals` spike)**:
- NEW `app/lib/api/client.ts`
- NEW `app/lib/api/signals.ts`
- EDIT `app/app/signals/page.tsx`
- EDIT `PROJECT_TRACKER.md`

**Phase 3 (remaining routes)** — one PR per route, same pattern: NEW `app/lib/api/{route}.ts`, EDIT the page(s), EDIT `PROJECT_TRACKER.md`.

**Phase 4 (cutover)**: no code changes in psx-ui beyond env var docs. Backend gets a CORS origin added.

---

## Hard constraints (re-stated for safety)

- **Do not modify any UI markup, layout, theme tokens, or component shape.** This is wiring, not redesign.
- **Do not add UI dependencies.** Only `next-auth` is approved.
- **Do not store tokens in `localStorage`.** ADR-1.
- **Do not introduce `NEXT_PUBLIC_*` env vars containing SECRET/TOKEN/PASSWORD/PRIVATE/CREDENTIAL.** ADR-4 + `scripts/check-env.mjs` will fail the build.
- **Do not change the `account.providerAccountId → token.user_id` mapping.** Existing users in the cloud DB are keyed off it.
- **Update `PROJECT_TRACKER.md` after every phase, not at the end.**
