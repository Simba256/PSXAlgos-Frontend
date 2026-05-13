"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import { Btn, DotRow, EditorialHeader, Kicker, Ribbon } from "@/components/atoms";
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
import type { DefaultRisk, StrategyResponse } from "@/lib/api/strategies";
import { getAllStocks, type StockResponse } from "@/lib/api/stocks";

interface StrategyPreview {
  name: string;
  totalReturnPct: number | null;
  sharpe: number | null;
  status: StrategyResponse["status"];
  // Hybrid exits (Option C): the strategy may carry default risk caps that
  // bot fields inherit when left null. Threaded through to UniverseAndRiskFields
  // so the four exit-risk inputs render as InheritableField with ghost +
  // override UX. See `docs/EXITS_IMPLEMENTATION_PLAN.md` Phase 5.
  defaultRisk: DefaultRisk | null;
}

const DEFAULT_NAME = `Bot ${new Date().toISOString().slice(0, 10)}`;

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

export default function BotWizardPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [strategyId, setStrategyId] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<StrategyPreview | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);

  // Wizard form state — single source of truth for all three stages.
  const [name, setName] = useState(DEFAULT_NAME);
  const [allocatedCapital, setAllocatedCapital] = useState<number>(1_000_000);
  const [maxPositions, setMaxPositions] = useState<number>(5);
  const [universeAndRisk, setUniverseAndRisk] = useState<UniverseAndRiskValue>(
    EMPTY_UNIVERSE_AND_RISK,
  );
  // B2 — bot-level risk controls. Opt-in; blank fields = control off.
  // Threaded through to the BotCreate request body in onLaunch.
  const [riskControls, setRiskControls] = useState<RiskControlsValue>(
    EMPTY_RISK_CONTROLS,
  );

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

  // Fetch strategy preview. Failures here are non-fatal (preview shows "—").
  useEffect(() => {
    if (!strategyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/strategies/${strategyId}`);
        if (!res.ok || cancelled) return;
        const s = (await res.json()) as StrategyResponse;
        const lb = s.latest_backtest ?? null;
        const toNum = (v: number | string | null | undefined): number | null => {
          if (v === null || v === undefined) return null;
          const n = typeof v === "number" ? v : Number(v);
          return Number.isFinite(n) ? n : null;
        };
        if (cancelled) return;
        setStrategy({
          name: s.name,
          totalReturnPct: toNum(lb?.total_return_pct),
          sharpe: toNum(lb?.sharpe_ratio),
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

  async function onLaunch() {
    setSubmitErr(null);
    if (!strategyId) {
      setSubmitErr("Open a strategy and use 'Spin up bot' to bind one.");
      return;
    }
    if (!name.trim()) {
      setSubmitErr("Give the bot a name.");
      return;
    }
    if (!Number.isFinite(allocatedCapital) || allocatedCapital <= 0) {
      setSubmitErr("Allocated capital must be greater than zero.");
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
      max_positions: maxPositions,
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
          return;
        }
        const msg = formatLaunchError(err, res.status);
        setSubmitErr(msg);
        return;
      }
      bot = (await res.json()) as BotResponse;
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : "Network error");
      return;
    }
    startTransition(() => router.push(`/bots/${bot.id}`));
  }

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
              <span>Step {step} of 3</span>
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
            padding: `14px ${padX}`,
            borderBottom: `1px solid ${T.outlineFaint}`,
            display: "flex",
            alignItems: isMobile ? "stretch" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 10 : 0,
          }}
        >
          {(
            [
              ["01", "Capital", "starting balance & sizing"],
              ["02", "Universe", "what to scan"],
              ["03", "Safety rails", "when to halt"],
            ] as const
          ).map(([n, t, d], i) => {
            const active = i + 1 === step;
            const done = i + 1 < step;
            return (
              <div
                key={n}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: active || done ? 1 : 0.45,
                }}
              >
                <span
                  style={{
                    fontFamily: T.fontHead,
                    fontSize: 28,
                    fontWeight: 300,
                    fontStyle: "italic",
                    color: active ? T.accent : done ? T.gain : T.text3,
                  }}
                >
                  {n}
                </span>
                <div>
                  <div style={{ fontFamily: T.fontHead, fontSize: 14, fontWeight: 500 }}>
                    {t}{" "}
                    {done && (
                      <span style={{ color: T.gain, fontSize: 11, marginLeft: 6 }}>✓</span>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: T.fontMono,
                      fontSize: 10,
                      color: T.text3,
                      textTransform: "uppercase",
                      letterSpacing: 0.7,
                      marginTop: 3,
                    }}
                  >
                    {d}
                  </div>
                </div>
                {i < 2 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: done ? T.gain + "66" : T.outlineFaint,
                      marginLeft: 20,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: pick(bp, {
              mobile: `24px ${padX} 28px`,
              desktop: `36px ${padX} 40px`,
            }),
            display: "grid",
            gridTemplateColumns: pick(bp, {
              mobile: "minmax(0, 1fr)",
              tablet: "minmax(0, 1fr)",
              desktop: "minmax(0, 1.1fr) minmax(0, 1fr)",
            }),
            gap: pick(bp, { mobile: 28, desktop: 60 }),
          }}
        >
          <div>
            {step === 1 && (
              <CapitalStep
                name={name}
                onName={setName}
                allocatedCapital={allocatedCapital}
                onAllocatedCapital={setAllocatedCapital}
                maxPositions={maxPositions}
                onMaxPositions={setMaxPositions}
              />
            )}
            {step === 2 && (
              <UniverseAndRiskFields
                value={universeAndRisk}
                onChange={setUniverseAndRisk}
                availableSectors={availableSectors}
                availableSymbols={availableSymbols}
                showRisk={false}
              />
            )}
            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                <UniverseAndRiskFields
                  value={universeAndRisk}
                  onChange={setUniverseAndRisk}
                  availableSectors={availableSectors}
                  availableSymbols={availableSymbols}
                  showUniverse={false}
                  strategyDefaults={strategy?.defaultRisk ?? null}
                />
                <RiskControlsSection value={riskControls} onChange={setRiskControls} />
              </div>
            )}
          </div>
          <Preview
            step={step}
            strategy={strategy}
            name={name}
            allocatedCapital={allocatedCapital}
            maxPositions={maxPositions}
            value={universeAndRisk}
          />
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
          {step > 1 && (
            <Btn variant="ghost" size="md" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
              ← Back
            </Btn>
          )}
          {step < 3 && (
            <Btn variant="primary" size="md" onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>
              Continue →
            </Btn>
          )}
          {step === 3 && (
            <Btn
              variant="deploy"
              size="md"
              icon={Icon.spark}
              onClick={() => {
                if (pending) return;
                void onLaunch();
              }}
              style={pending ? { opacity: 0.6, cursor: "wait" } : undefined}
            >
              {pending ? "Launching…" : "Launch bot →"}
            </Btn>
          )}
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

function CapitalStep({
  name,
  onName,
  allocatedCapital,
  onAllocatedCapital,
  maxPositions,
  onMaxPositions,
}: {
  name: string;
  onName: (v: string) => void;
  allocatedCapital: number;
  onAllocatedCapital: (v: number) => void;
  maxPositions: number;
  onMaxPositions: (v: number) => void;
}) {
  const T = useT();
  const presets = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <Kicker>bot name</Kicker>
        <input
          type="text"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="e.g. Momentum · live"
          style={{
            marginTop: 10,
            background: T.surface,
            color: T.text,
            border: "none",
            boxShadow: `0 0 0 1px ${T.outlineFaint}`,
            borderRadius: 6,
            padding: "10px 14px",
            fontFamily: T.fontSans,
            fontSize: 15,
            width: "100%",
            maxWidth: 420,
          }}
        />
      </div>

      <div>
        <Kicker info="Paper money the bot starts with. Used for sizing each trade.">
          starting capital · PKR
        </Kicker>
        <div
          style={{
            marginTop: 12,
            fontFamily: T.fontHead,
            fontSize: "clamp(40px, 10vw, 64px)",
            fontWeight: 500,
            letterSpacing: -1.4,
            color: T.text,
            lineHeight: 1.05,
          }}
        >
          <input
            type="number"
            value={allocatedCapital}
            min={1}
            step={10000}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n) && n > 0) onAllocatedCapital(n);
            }}
            style={{
              background: "transparent",
              color: T.text,
              border: "none",
              outline: "none",
              padding: 0,
              fontFamily: T.fontHead,
              fontSize: "inherit",
              fontWeight: 500,
              letterSpacing: -1.4,
              width: "100%",
              maxWidth: 360,
            }}
          />
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {presets.map((amount) => {
            const active = allocatedCapital === amount;
            const label = amount >= 1_000_000 ? `${amount / 1_000_000}M` : `${amount / 1000}K`;
            return (
              <button
                key={amount}
                type="button"
                onClick={() => onAllocatedCapital(amount)}
                aria-pressed={active}
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: active ? T.primary : "transparent",
                  color: active ? "#fff" : T.text2,
                  border: `1px solid ${active ? T.primary : T.outlineFaint}`,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Kicker info="Cap on how many positions the bot can hold open at the same time.">
          max concurrent positions
        </Kicker>
        <input
          type="number"
          value={maxPositions}
          min={1}
          max={20}
          step={1}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 1 && n <= 20) onMaxPositions(n);
          }}
          style={{
            marginTop: 10,
            background: T.surface,
            color: T.text,
            border: "none",
            boxShadow: `0 0 0 1px ${T.outlineFaint}`,
            borderRadius: 6,
            padding: "10px 14px",
            fontFamily: T.fontMono,
            fontSize: 14,
            width: 140,
          }}
        />
      </div>

      <div
        style={{
          padding: 14,
          background: T.surfaceLow,
          borderRadius: 6,
          fontSize: 12.5,
          color: T.text3,
          lineHeight: 1.6,
        }}
      >
        Paper money — no real broker is connected. The bot simulates a portfolio so you can see
        how the strategy would have performed.
      </div>
    </div>
  );
}

function Preview({
  step,
  strategy,
  name,
  allocatedCapital,
  maxPositions,
  value,
}: {
  step: 1 | 2 | 3;
  strategy: StrategyPreview | null;
  name: string;
  allocatedCapital: number;
  maxPositions: number;
  value: UniverseAndRiskValue;
}) {
  const T = useT();
  const fmtPct = (n: number | null): string =>
    n === null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  const fmtPctOrDash = (n: number | null | undefined): string =>
    n == null ? "—" : `${n}%`;
  const fmtNumOrDash = (n: number | null | undefined): string =>
    n == null ? "—" : String(n);
  // Effective-value resolver mirrors the backend's risk_inheritance service:
  // override (form value) takes precedence; otherwise fall back to the
  // strategy default. Returns the value plus whether it's inherited so the
  // preview can render an "inherit" hint without lying about the active cap.
  const eff = (
    formValue: number | null | undefined,
    strategyDefault: number | null | undefined,
  ): { v: number | null; inherited: boolean } => {
    if (formValue != null) return { v: formValue, inherited: false };
    if (strategyDefault != null) return { v: strategyDefault, inherited: true };
    return { v: null, inherited: false };
  };
  const stopLoss = eff(value.stop_loss_pct, strategy?.defaultRisk?.stop_loss_pct);
  const takeProfit = eff(value.take_profit_pct, strategy?.defaultRisk?.take_profit_pct);
  const trailingStop = eff(value.trailing_stop_pct, strategy?.defaultRisk?.trailing_stop_pct);
  const maxHoldingDays = eff(value.max_holding_days, strategy?.defaultRisk?.max_holding_days);
  const backtestColor =
    strategy?.totalReturnPct == null
      ? T.text3
      : strategy.totalReturnPct >= 0
      ? T.gain
      : T.loss;

  const filters = value.stock_filters ?? {};
  const sectors = filters.sectors ?? [];
  const symbols = value.stock_symbols ?? [];
  const universeSummary = (() => {
    // Sectors and explicit tickers compose under union semantics on the
    // backend (B048) — both can be set and they're merged, not exclusive.
    const parts: string[] = [];
    if (sectors.length > 0) {
      parts.push(sectors.length === 1 ? sectors[0] : `${sectors.length} sectors`);
    }
    if (symbols.length > 0) {
      parts.push(`${symbols.length} ticker${symbols.length === 1 ? "" : "s"}`);
    }
    if (parts.length === 0) return "—";
    return parts.join(" + ");
  })();

  return (
    <div>
      <Ribbon kicker="preview · your bot" />
      <div style={{ marginTop: 14 }}>
        <DotRow label="Name" value={name || "—"} bold />
        <DotRow
          label="Strategy"
          value={strategy?.name ?? "—"}
          color={strategy ? T.primaryLight : T.text3}
        />
        <DotRow
          label="Last backtest"
          value={fmtPct(strategy?.totalReturnPct ?? null)}
          color={backtestColor}
        />
        <DotRow
          label="Sharpe"
          value={strategy?.sharpe == null ? "—" : strategy.sharpe.toFixed(2)}
          color={strategy?.sharpe == null ? T.text3 : T.text2}
        />
        <DotRow
          label="Starting capital"
          value={`PKR ${allocatedCapital.toLocaleString()}`}
        />
        <DotRow label="Max concurrent" value={`${maxPositions} positions`} />
        <DotRow
          label="Universe"
          value={universeSummary}
          color={universeSummary === "—" ? T.text3 : T.text2}
        />
        <DotRow
          label="Stop loss"
          value={
            stopLoss.v == null
              ? "—"
              : `${fmtPctOrDash(stopLoss.v)}${stopLoss.inherited ? " · inherited" : ""}`
          }
          color={stopLoss.v != null && step >= 3 ? (stopLoss.inherited ? T.text3 : T.loss) : T.text3}
        />
        <DotRow
          label="Take profit"
          value={
            takeProfit.v == null
              ? "—"
              : `${fmtPctOrDash(takeProfit.v)}${takeProfit.inherited ? " · inherited" : ""}`
          }
          color={takeProfit.v != null && step >= 3 ? (takeProfit.inherited ? T.text3 : T.gain) : T.text3}
        />
        <DotRow
          label="Trailing stop"
          value={
            trailingStop.v == null
              ? "—"
              : `${fmtPctOrDash(trailingStop.v)}${trailingStop.inherited ? " · inherited" : ""}`
          }
          color={trailingStop.v != null && step >= 3 ? T.text2 : T.text3}
        />
        <DotRow
          label="Max holding days"
          value={
            maxHoldingDays.v == null
              ? "—"
              : `${fmtNumOrDash(maxHoldingDays.v)}${maxHoldingDays.inherited ? " · inherited" : ""}`
          }
          color={maxHoldingDays.v != null && step >= 3 ? T.text2 : T.text3}
        />
      </div>
      {step === 3 && (
        <div
          style={{
            marginTop: 28,
            padding: 16,
            background: T.deploy + "11",
            borderRadius: 6,
            border: `1px solid ${T.deploy}55`,
          }}
        >
          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 10.5,
              color: T.deploy,
              letterSpacing: 0.7,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Ready to launch
          </div>
          <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.55 }}>
            Bot will start on the next market open. You can pause at any time from the dashboard.
          </div>
        </div>
      )}
    </div>
  );
}
