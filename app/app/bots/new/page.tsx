"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import { Btn, EditorialHeader, Kicker } from "@/components/atoms";
import { Disclosure } from "@/components/disclosure";
import { useSessionStorage } from "@/components/use-session-storage";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick } from "@/components/responsive";
import {
  EMPTY_UNIVERSE_AND_RISK,
  UniverseAndRiskFields,
  validateUniverseSelection,
  type UniverseAndRiskValue,
} from "@/components/universe-and-risk-fields";
import {
  EMPTY_RISK_CONTROLS,
  RiskControlsSection,
  type RiskControlsValue,
} from "@/components/risk-controls-section";
import type { BotCreateBody, BotResponse } from "@/lib/api/bots";
import type {
  DefaultRisk,
  StrategyResponse,
  StrategyListResponse,
  StrategyStatus,
} from "@/lib/api/strategies";
import { getAllStocks, type StockResponse } from "@/lib/api/stocks";

interface StrategyPreview {
  name: string;
  status: StrategyResponse["status"];
  // Hybrid exits (Option C): the strategy may carry default risk caps that
  // bot fields inherit when left null. Threaded through to the risk grid so
  // the four exit-risk inputs render as InheritableField with ghost +
  // override UX. See `docs/EXITS_IMPLEMENTATION_PLAN.md` Phase 5.
  defaultRisk: DefaultRisk | null;
}

// Computed lazily per-mount so a form opened after midnight uses today's
// date instead of the date the module was first evaluated.
function defaultBotName(): string {
  return `Bot ${new Date().toISOString().slice(0, 10)}`;
}

function formatPkr(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-PK").format(Math.round(n));
}

function compactPkr(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString("en-PK", { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return `${n}`;
}

// Unwraps the Next proxy / FastAPI error envelope into a single readable
// sentence. FastAPI 422s arrive as `{detail: [{loc, msg}, ...]}` — without
// this helper they stringify to "[object Object]" in the toast.
function formatLaunchError(err: unknown, status: number): string {
  if (err && typeof err === "object") {
    const e = err as { error?: unknown; detail?: unknown };
    if (typeof e.error === "string" && e.error.length > 0 && !e.error.includes("[object Object]")) {
      return e.error;
    }
    const detail = e.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object") {
      const d = detail as { detail?: unknown };
      const inner = d.detail;
      if (typeof inner === "string") return inner;
      if (Array.isArray(inner)) {
        const msgs = inner
          .map((it) => {
            if (!it || typeof it !== "object") return null;
            const item = it as { loc?: unknown; msg?: unknown };
            const loc = Array.isArray(item.loc)
              ? item.loc.filter((p) => p !== "body").join(".")
              : "";
            const msg = typeof item.msg === "string" ? item.msg : "invalid";
            return loc ? `${loc}: ${msg}` : msg;
          })
          .filter((m): m is string => Boolean(m));
        if (msgs.length > 0) return msgs.join("; ");
      }
    }
  }
  return `Create failed (${status})`;
}

export default function BotNewPage() {
  const [strategyId, setStrategyId] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<StrategyPreview | null>(null);
  // The user's strategies, for the in-form picker — so "Create bot" is a
  // self-contained flow (like /backtest/new) and doesn't require opening a
  // strategy first. Pre-selected when a strategy_id arrives via the URL
  // (e.g. the editor's "Spin up bot" pill).
  const [strategies, setStrategies] = useState<
    { id: number; name: string; status: StrategyStatus }[]
  >([]);
  const [strategiesLoading, setStrategiesLoading] = useState(true);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  // useTransition's `pending` only flips once the post-fetch router.push
  // runs inside startTransition, so it can't guard the fetch itself.
  // `submitting` covers the network round-trip.
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);

  // Form state — single source of truth for the whole page.
  const [name, setName] = useState(defaultBotName);
  const [allocatedCapital, setAllocatedCapital] = useState<number>(1_000_000);
  // Holds universe scope + the risk guardrails + max_positions. Seeded with
  // max_positions: 5 so the default matches the old wizard's sizing default
  // even when the user never opens the "risk caps" disclosure.
  const [universeAndRisk, setUniverseAndRisk] = useState<UniverseAndRiskValue>({
    ...EMPTY_UNIVERSE_AND_RISK,
    max_positions: 5,
  });
  // B2 — bot-level risk controls. Opt-in; blank fields = control off.
  const [riskControls, setRiskControls] = useState<RiskControlsValue>(
    EMPTY_RISK_CONTROLS,
  );
  // Two independent disclosures sit side by side — "risk caps" (the trade
  // guardrails) on the left, "risk controls" (the opt-in safety nets) on the
  // right. Separate open keys so each remembers its own state.
  const [capsOpen, setCapsOpen] = useSessionStorage<boolean>("psx:bot:caps-open", false);
  const [controlsOpen, setControlsOpen] = useSessionStorage<boolean>("psx:bot:controls-open", false);

  // PSX stock universe — fetched once on mount, used for sector + symbol pickers.
  const [stocks, setStocks] = useState<StockResponse[]>([]);
  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    for (const s of stocks) {
      if (s.sector_name && s.is_active) set.add(s.sector_name);
    }
    return Array.from(set).sort();
  }, [stocks]);
  const availableSymbols = useMemo(
    () =>
      stocks
        .filter((s) => s.is_active)
        .map((s) => ({ symbol: s.symbol, name: s.name }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [stocks],
  );

  // strategyId from query string. Reading via window keeps the page out of
  // the Next 16 CSR-bailout error if it's ever prerendered.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URL(window.location.href).searchParams.get("strategy_id");
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) setStrategyId(n);
  }, []);

  // Fetch strategy preview. Failures here are non-fatal.
  useEffect(() => {
    if (!strategyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/strategies/${strategyId}`);
        if (!res.ok || cancelled) return;
        const s = (await res.json()) as StrategyResponse;
        if (cancelled) return;
        setStrategy({
          name: s.name,
          status: s.status,
          defaultRisk: s.exit_rules?.default_risk ?? null,
        });
      } catch {
        // swallow
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [strategyId]);

  // Load PSX universe once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all = await getAllStocks().catch(() => []);
      if (!cancelled) setStocks(all);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the user's strategies once for the picker. Non-fatal on failure —
  // the picker just shows the "no strategies" copy.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/strategies", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as StrategyListResponse;
        if (cancelled) return;
        setStrategies(
          body.items.map((s) => ({ id: s.id, name: s.name, status: s.status })),
        );
      } catch {
        // swallow — leaves the list empty
      } finally {
        if (!cancelled) setStrategiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLaunch() {
    if (submitting) return;
    setSubmitErr(null);
    if (!strategyId) {
      setSubmitErr("Pick a strategy to bind this bot to.");
      return;
    }
    if (!name.trim()) {
      setSubmitErr("Give the bot a name.");
      return;
    }
    if (!Number.isFinite(allocatedCapital) || allocatedCapital <= 0) {
      setSubmitErr("Starting capital must be greater than zero.");
      return;
    }
    // Universe scope guard — surfaces inline rather than letting the
    // backend bounce a 422. The same validator runs on the editor and
    // backtest forms so the wording stays consistent.
    const universeErr = validateUniverseSelection(universeAndRisk);
    if (universeErr) {
      setSubmitErr(universeErr);
      return;
    }
    // Narrowed by the validator above — assert for the typed body.
    if (universeAndRisk.universe_scope === null) return;
    const body = {
      strategy_id: strategyId,
      name: name.trim(),
      allocated_capital: allocatedCapital,
      max_positions: universeAndRisk.max_positions ?? 5,
      universe_scope: universeAndRisk.universe_scope,
      stock_filters: universeAndRisk.stock_filters,
      stock_symbols: universeAndRisk.stock_symbols,
      stop_loss_pct: universeAndRisk.stop_loss_pct ?? null,
      take_profit_pct: universeAndRisk.take_profit_pct ?? null,
      trailing_stop_pct: universeAndRisk.trailing_stop_pct ?? null,
      max_holding_days: universeAndRisk.max_holding_days ?? null,
      // B2 risk controls — null is the "off" sentinel; backend
      // stores NULL and skips that control's enforcement.
      daily_loss_limit_pct: riskControls.daily_loss_limit_pct,
      max_drawdown_pause_pct: riskControls.max_drawdown_pause_pct,
      stale_data_max_age_days: riskControls.stale_data_max_age_days,
      stale_universe_halt_pct: riskControls.stale_universe_halt_pct,
      max_per_sector_pct: riskControls.max_per_sector_pct,
    } satisfies BotCreateBody;
    setSubmitting(true);
    let bot: BotResponse;
    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setSubmitErr("Creating bots requires the Pro+ plan. Upgrade to continue.");
          setSubmitting(false);
          return;
        }
        if (res.status === 409) {
          const msg = (err as { error?: string }).error ?? `A bot named "${name.trim()}" already exists — pick a different name.`;
          setSubmitErr(msg);
          setNameError(true);
          setSubmitting(false);
          return;
        }
        const msg = formatLaunchError(err, res.status);
        setSubmitErr(msg);
        setSubmitting(false);
        return;
      }
      bot = (await res.json()) as BotResponse;
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
      return;
    }
    startTransition(() => router.push(`/bots/${bot.id}`));
  }

  const launching = pending || submitting;
  const riskActiveCount = (Object.values(riskControls) as Array<number | null>).filter(
    (v) => v !== null,
  ).length;
  const capsSummary = (() => {
    const parts: string[] = [];
    if (universeAndRisk.stop_loss_pct != null) parts.push(`stop ${universeAndRisk.stop_loss_pct}%`);
    if (universeAndRisk.take_profit_pct != null) parts.push(`take ${universeAndRisk.take_profit_pct}%`);
    if (universeAndRisk.max_positions != null) parts.push(`max ${universeAndRisk.max_positions} pos`);
    return parts.length ? parts.join(" · ") : "defaults";
  })();
  const controlsSummary =
    riskActiveCount > 0
      ? `${riskActiveCount} active`
      : "off";

  return (
    <AppFrame route="/bots">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorialHeader
          kicker={
            <>
              <Link href="/strategies" style={{ color: T.primaryLight }}>
                Strategies
              </Link>{" "}
              / {strategy?.name ?? (strategyId ? "loading…" : "no strategy")} /{" "}
              <span style={{ color: T.text2 }}>bind bot</span>
            </>
          }
          title={
            <>
              Spin up a{" "}
              <span style={{ fontStyle: "italic", color: T.accent, fontWeight: 400 }}>bot</span>.
            </>
          }
          meta={
            <>
              <span>
                Bound to{" "}
                {strategyId && strategy ? (
                  <Link
                    href={`/strategies/${strategyId}`}
                    style={{ color: T.primaryLight, textDecoration: "none" }}
                  >
                    {strategy.name}
                  </Link>
                ) : (
                  <span style={{ color: T.text3 }}>
                    {strategyId ? "loading…" : "no strategy"}
                  </span>
                )}
              </span>
              <span style={{ color: T.text3 }}>paper-trading only</span>
            </>
          }
          actions={
            <Link href="/bots" style={{ textDecoration: "none" }}>
              <Btn variant="ghost" size="sm">
                Cancel
              </Btn>
            </Link>
          }
        />

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: pick(bp, {
              mobile: `20px ${padX} 28px`,
              desktop: `28px ${padX} 40px`,
            }),
            scrollPaddingBottom: 96,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 32,
              minWidth: 0,
              maxWidth: 760,
            }}
          >
            <StrategyPickerField
              strategies={strategies}
              value={strategyId}
              loading={strategiesLoading}
              onChange={(id) => {
                setStrategyId(id);
                setSubmitErr(null);
              }}
            />

            <NameField
              name={name}
              onName={(v) => {
                setName(v);
                setNameError(false);
                setSubmitErr(null);
              }}
              nameError={nameError}
            />

            <CapitalField
              value={allocatedCapital}
              onChange={setAllocatedCapital}
              disabled={launching}
            />

            <UniverseAndRiskFields
              value={universeAndRisk}
              onChange={setUniverseAndRisk}
              availableSectors={availableSectors}
              availableSymbols={availableSymbols}
              showRisk={false}
              scopeVariant="dropdown"
              disabled={launching}
            />

            {/* Risk caps (left) and risk controls (right) — two equal-width
                disclosures sitting alongside each other, each opening
                independently into the same bar grid as the backtest form.
                Stacks to one column on phones. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: pick(bp, { mobile: "1fr", desktop: "1fr 1fr" }),
                gap: pick(bp, { mobile: 8, desktop: 24 }),
                alignItems: "start",
              }}
            >
              <Disclosure
                label="risk caps"
                summary={capsSummary}
                open={capsOpen}
                onToggle={() => setCapsOpen((v) => !v)}
                tone="muted"
              >
                <UniverseAndRiskFields
                  value={universeAndRisk}
                  onChange={setUniverseAndRisk}
                  availableSectors={availableSectors}
                  availableSymbols={availableSymbols}
                  showUniverse={false}
                  riskBare
                  strategyDefaults={strategy?.defaultRisk ?? null}
                  disabled={launching}
                />
              </Disclosure>

              <Disclosure
                label="risk controls"
                summary={controlsSummary}
                open={controlsOpen}
                onToggle={() => setControlsOpen((v) => !v)}
                tone="muted"
              >
                <RiskControlsSection
                  value={riskControls}
                  onChange={setRiskControls}
                  variant="compact"
                />
              </Disclosure>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: `14px ${padX}`,
            borderTop: `1px solid ${T.outlineFaint}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
            Paper-trading · no real broker connected
          </span>
          <div style={{ flex: 1 }} />
          <Btn
            variant="deploy"
            size="md"
            icon={Icon.spark}
            onClick={() => {
              if (launching) return;
              void onLaunch();
            }}
            style={{
              ...(launching ? { opacity: 0.6, cursor: "wait" } : undefined),
              ...(isMobile ? { width: "100%", justifyContent: "center" } : undefined),
            }}
          >
            {launching ? "Launching…" : "Launch bot →"}
          </Btn>
        </div>
        {submitErr && (
          <div
            role="alert"
            style={{
              padding: `10px ${padX}`,
              borderTop: `1px solid ${T.outlineFaint}`,
              background: T.surfaceLow,
              fontFamily: T.fontMono,
              fontSize: 12,
              color: T.loss,
            }}
          >
            {submitErr}
          </div>
        )}
      </div>
    </AppFrame>
  );
}

function StrategyPickerField({
  strategies,
  value,
  loading,
  onChange,
}: {
  strategies: { id: number; name: string; status: StrategyStatus }[];
  value: number | null;
  loading: boolean;
  onChange: (id: number | null) => void;
}) {
  const T = useT();

  // No strategies yet — a bot can't exist without one, so point the user at
  // the strategy builder instead of an empty dropdown.
  if (!loading && strategies.length === 0) {
    return (
      <div>
        <Kicker info="A bot trades one of your strategies. Build a strategy first, then spin up a bot from it.">
          strategy
        </Kicker>
        <div
          style={{
            marginTop: 10,
            fontFamily: T.fontSans,
            fontSize: 13,
            color: T.text3,
            lineHeight: 1.6,
            maxWidth: 420,
          }}
        >
          You don&apos;t have any strategies yet.{" "}
          <Link href="/strategies/new" style={{ color: T.primaryLight }}>
            Create one
          </Link>{" "}
          first, then come back to launch a bot.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Kicker info="The entry/exit rules this bot will trade. Pick one of your strategies.">
        strategy
      </Kicker>
      <select
        value={value ?? ""}
        disabled={loading}
        aria-label="Strategy to bind"
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
        style={{
          marginTop: 10,
          background: T.surface,
          color: value ? T.text : T.text3,
          border: "none",
          boxShadow: `0 0 0 1px ${T.outlineFaint}`,
          borderRadius: 6,
          padding: "10px 14px",
          fontFamily: T.fontSans,
          fontSize: 15,
          width: "100%",
          maxWidth: 420,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        <option value="">
          {loading ? "Loading strategies…" : "Select a strategy…"}
        </option>
        {strategies.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.status !== "ACTIVE" ? ` · ${s.status.toLowerCase()}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function NameField({
  name,
  onName,
  nameError,
}: {
  name: string;
  onName: (v: string) => void;
  nameError: boolean;
}) {
  const T = useT();
  return (
    <div>
      <Kicker>bot name</Kicker>
      <input
        type="text"
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="e.g. Momentum · live"
        aria-label="Bot name"
        style={{
          marginTop: 10,
          background: T.surface,
          color: T.text,
          border: "none",
          boxShadow: `0 0 0 1px ${nameError ? T.loss : T.outlineFaint}`,
          borderRadius: 6,
          padding: "10px 14px",
          fontFamily: T.fontSans,
          fontSize: 15,
          width: "100%",
          maxWidth: 420,
          outline: nameError ? `2px solid ${T.loss}` : "none",
        }}
      />
      {nameError && (
        <div style={{ marginTop: 6, fontSize: 12, color: T.loss }}>
          This name is already taken — enter a different one.
        </div>
      )}
    </div>
  );
}

// Starting-capital field — mirrors the backtest "initial capital · pkr"
// control: a Rs-prefixed text input (formatted with commas when blurred) plus
// quick-pick preset pills.
function CapitalField({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const T = useT();
  const presets = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000];
  // Local string state so the user can type freely (clearing the input,
  // typing intermediate states) without the parent committing every keystroke
  // at sub-1 values.
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const displayValue = focused
    ? text
    : Number.isFinite(Number(text.replace(/,/g, "")))
      ? formatPkr(Number(text.replace(/,/g, "")))
      : text;

  return (
    <div>
      <Kicker info="Paper money the bot starts with. Used to size each simulated trade.">
        starting capital · pkr
      </Kicker>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative" }}>
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              fontFamily: T.fontMono,
              fontSize: 12,
              color: T.text3,
              pointerEvents: "none",
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Rs
          </span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="Starting capital in PKR"
            value={displayValue}
            disabled={disabled}
            onFocus={() => setFocused(true)}
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, "");
              setText(raw);
              const n = parseFloat(raw);
              if (Number.isFinite(n) && n > 0) onChange(n);
            }}
            onBlur={() => {
              setFocused(false);
              const n = parseFloat(text.replace(/,/g, ""));
              if (Number.isFinite(n) && n > 0) {
                onChange(n);
                setText(String(n));
              }
            }}
            style={{
              background: T.surface,
              color: T.text,
              border: "none",
              boxShadow: `0 0 0 1px ${T.outlineFaint}`,
              borderRadius: 6,
              padding: "10px 14px 10px 38px",
              fontFamily: T.fontMono,
              fontSize: 14,
              fontVariantNumeric: "tabular-nums",
              width: 220,
              opacity: disabled ? 0.6 : 1,
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {presets.map((amount) => {
            const active = value === amount;
            return (
              <button
                key={amount}
                type="button"
                onClick={() => onChange(amount)}
                disabled={disabled}
                aria-pressed={active}
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: active ? T.primary : "transparent",
                  color: active ? "#fff" : T.text2,
                  border: `1px solid ${active ? T.primary : T.outlineFaint}`,
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {compactPkr(amount)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
