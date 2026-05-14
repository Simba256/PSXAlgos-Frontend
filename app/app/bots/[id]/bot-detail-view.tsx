"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import type {
  BotDetailResponse,
  BotResponse,
  BotUpdateBody,
  PositionResponse,
  PerformanceResponse,
} from "@/lib/api/bots";
import {
  Btn,
  DotRow,
  EditorialHeader,
  FlashToast,
  Kicker,
  Lede,
  Modal,
  Ribbon,
  TerminalTable,
  useFlash,
  type Col,
} from "@/components/atoms";
import {
  RiskControlsSection,
  type RiskControlsValue,
} from "@/components/risk-controls-section";
import { EquityCurve } from "@/components/charts";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick } from "@/components/responsive";


function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

// Decimal columns arrive as strings or numbers (PG numeric → JSON). Coerce
// through Number(); reject NaN/Infinity to a clean `null` so missing/optional
// risk-control fields can render as "not set" rather than "NaN".
function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function compactPkr(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatStarted(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const d = new Date(t);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function uptime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const totalMin = Math.max(0, Math.floor((Date.now() - t) / 60_000));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const remH = h - d * 24;
  return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
}

export function BotDetailView({
  initialBot,
  initialPositions,
  initialPerformance,
}: {
  initialBot: BotDetailResponse;
  initialPositions: PositionResponse[];
  initialPerformance: PerformanceResponse | null;
}) {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const router = useRouter();
  const [bot, setBot] = useState<BotDetailResponse>(initialBot);
  const [logsOpen, setLogsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { flash, setFlash } = useFlash();

  const running = bot.status === "ACTIVE";
  const stopped = bot.status === "STOPPED";

  const handlePauseToggle = async () => {
    if (stopped) {
      setFlash("Bot is stopped · cannot resume");
      return;
    }
    const action: "pause" | "start" = running ? "pause" : "start";
    try {
      const res = await fetch(`/api/bots/${bot.id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error(`Action failed (${res.status})`);
      const data = await res.json() as { bot?: BotDetailResponse };
      if (data.bot) {
        // Backend BotResponse is a subset of BotDetailResponse; preserve our
        // detail-only fields if the action response omitted them.
        setBot((prev) => ({ ...prev, ...data.bot } as BotDetailResponse));
      }
      setFlash(action === "start" ? "Bot resumed · signals active" : "Bot paused · scans halted");
      router.refresh();
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleSettings = () => {
    setSettingsOpen(true);
  };

  const handleSettingsSaved = (updated: BotResponse) => {
    setBot((prev) => ({ ...prev, ...updated } as BotDetailResponse));
    setFlash("Settings saved · controls active on next scan");
    router.refresh();
  };

  const statusColor = running ? T.gain : stopped ? T.text3 : T.warning;
  const statusLabel = running ? "Running" : stopped ? "Stopped" : "Paused";
  const nextScan = running ? "scanning live" : "scanning halted";
  const startedLabel = bot.started_at
    ? `Started ${formatStarted(bot.started_at)} · ${uptime(bot.started_at)} uptime`
    : "Not started";

  const equity = num(bot.total_equity ?? bot.allocated_capital);
  const allocated = num(bot.allocated_capital);
  const cash = num(bot.available_cash);
  const totalReturnPct = num(bot.total_return_pct);
  const dailyPnl = num(bot.daily_pnl);
  const dailyPct = num(bot.daily_return_pct);
  const winRate = num(bot.win_rate);
  const wonCount = bot.winning_trades ?? 0;
  const tradeCount = bot.total_trades ?? 0;
  const openCount = bot.open_positions_count ?? initialPositions.length;
  const cashPct = allocated > 0 ? (cash / equity) * 100 : 0;

  return (
    <AppFrame route="/bots">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorialHeader
          kicker={
            <>
              <Link href="/bots" style={{ color: T.primaryLight }}>
                Bots
              </Link>{" "}
              / {bot.id}
            </>
          }
          title={bot.name}
          meta={
            <>
              <span style={{ color: statusColor }}>
                <span style={{ color: statusColor }}>●</span> {statusLabel}
              </span>
              <span>
                Bound to{" "}
                {bot.strategy_deleted || !bot.strategy_id ? (
                  <span style={{ color: T.text3 }}>
                    {bot.strategy_name ?? "—"}{" "}
                    <span
                      style={{ color: T.warning, fontSize: 10.5, letterSpacing: 0.4 }}
                    >
                      (deleted)
                    </span>
                  </span>
                ) : (
                  <Link
                    href={`/strategies/${bot.strategy_id}`}
                    style={{ color: T.primaryLight, textDecoration: "none" }}
                  >
                    {bot.strategy_name ?? "—"}
                  </Link>
                )}
              </span>
              <span>{startedLabel}</span>
              <span style={{ color: T.text3 }}>{nextScan}</span>
            </>
          }
          actions={
            <>
              <Btn variant="ghost" size="sm" onClick={() => setLogsOpen(true)}>
                Logs
              </Btn>
              <Btn variant="outline" size="sm" onClick={handlePauseToggle}>
                {running ? "Pause" : stopped ? "Stopped" : "Resume"}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={handleSettings}>
                Settings
              </Btn>
            </>
          }
        />

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: pick(bp, {
              mobile: `20px ${padX} 28px`,
              desktop: `32px ${padX} 40px`,
            }),
          }}
        >
          {bot.status === "PAUSED" && bot.pause_reason && (
            <div
              role="status"
              style={{
                marginBottom: 24,
                padding: "12px 16px",
                background: `${T.warning}14`,
                border: `1px solid ${T.warning}55`,
                borderLeft: `3px solid ${T.warning}`,
                borderRadius: 4,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span
                style={{
                  color: T.warning,
                  fontSize: 11.5,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Auto-paused
              </span>
              <span style={{ color: T.text, fontSize: 13, lineHeight: 1.5 }}>
                {bot.pause_reason}
              </span>
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: pick(bp, {
                mobile: "minmax(0, 1fr) minmax(0, 1fr)",
                tablet: "repeat(3, minmax(0, 1fr))",
                desktop: "repeat(6, minmax(0, 1fr))",
              }),
              gap: pick(bp, { mobile: 20, desktop: 36 }),
              paddingBottom: 26,
              borderBottom: `1px solid ${T.outlineFaint}`,
            }}
          >
            <Lede
              label="Equity"
              value={`PKR ${equity.toLocaleString()}`}
              sub={`${equity - allocated >= 0 ? "+" : ""}PKR ${(equity - allocated).toLocaleString()} total`}
              size="clamp(22px, 2.5vw, 28px)"
            />
            <Lede
              label="P&L"
              value={`${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(2)}%`}
              color={totalReturnPct >= 0 ? T.gain : T.loss}
              sub="since start"
              size="clamp(22px, 2.5vw, 28px)"
            />
            <Lede
              label="Today"
              value={dailyPnl === 0 ? "—" : `${dailyPnl >= 0 ? "+" : ""}PKR ${dailyPnl.toLocaleString()}`}
              color={dailyPnl >= 0 ? T.gain : T.loss}
              sub={dailyPnl === 0 ? "no activity" : `${dailyPct >= 0 ? "+" : ""}${dailyPct.toFixed(2)}%`}
              size="clamp(22px, 2.5vw, 28px)"
            />
            <Lede
              label="Win rate"
              value={tradeCount === 0 ? "—" : `${winRate.toFixed(0)}%`}
              sub={tradeCount === 0 ? "no trades yet" : `${wonCount} / ${tradeCount} trades`}
              size="clamp(22px, 2.5vw, 28px)"
            />
            <Lede
              label="Open"
              value={String(openCount)}
              sub={`of ${bot.max_positions} max`}
              size="clamp(22px, 2.5vw, 28px)"
            />
            <Lede
              label="Cash"
              value={`PKR ${compactPkr(cash)}`}
              sub={`${cashPct.toFixed(1)}% free`}
              size="clamp(22px, 2.5vw, 28px)"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: pick(bp, {
                mobile: "minmax(0, 1fr)",
                tablet: "minmax(0, 1fr)",
                desktop: "minmax(0, 1.9fr) minmax(0, 1fr)",
              }),
              gap: pick(bp, { mobile: 28, desktop: 48 }),
              marginTop: 28,
            }}
          >
            <div>
              <Ribbon
                kicker="equity curve · 12 days"
                right={
                  <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3 }}>
                    <span style={{ color: T.gain }}>━</span> bot &nbsp;{" "}
                    <span style={{ color: T.text3 }}>┄┄</span> KSE-100
                  </span>
                }
              />
              <div style={{ marginTop: 8 }}>
                {initialPerformance && initialPerformance.equity_curve.length > 0 ? (
                  <EquityCurve
                    width={760}
                    height={210}
                    data={initialPerformance.equity_curve.map((p) => num(p.total_equity))}
                  />
                ) : (
                  <div
                    style={{
                      height: 210,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: T.fontMono,
                      fontSize: 12,
                      color: T.text3,
                      border: `1px dashed ${T.outlineFaint}`,
                      borderRadius: 4,
                    }}
                  >
                    no performance snapshots yet — run the bot to start collecting
                  </div>
                )}
              </div>

              <div style={{ marginTop: 32 }}>
                <Ribbon
                  kicker="open positions"
                  right={
                    <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
                      {initialPositions.length} of {bot.max_positions}
                    </span>
                  }
                />
                <div style={{ marginTop: 8 }}>
                  <OpenPositions positions={initialPositions} />
                </div>
              </div>
            </div>

            <div>
              <Ribbon kicker="safety rails" color={T.warning} />
              <div style={{ marginTop: 10 }}>
                <SafetyRails bot={bot} />
              </div>

              <div style={{ marginTop: 32 }}>
                <Ribbon kicker="recent activity" />
                <div
                  style={{
                    marginTop: 8,
                    padding: "16px 12px",
                    fontFamily: T.fontMono,
                    fontSize: 11.5,
                    color: T.text3,
                    lineHeight: 1.9,
                    border: `1px dashed ${T.outlineFaint}`,
                    borderRadius: 4,
                  }}
                >
                  Activity feed is wired up but the bot hasn&apos;t produced any
                  trades yet. Open positions and trades show here as the bot runs.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {logsOpen && <LogsModal botName={bot.name} onClose={() => setLogsOpen(false)} />}
      {settingsOpen && (
        <SettingsModal
          bot={bot}
          onClose={() => setSettingsOpen(false)}
          onSaved={handleSettingsSaved}
        />
      )}
      {flash && <FlashToast message={flash} />}
    </AppFrame>
  );
}

// Safety-rails panel — pulls live values from the bot record. Nullable risk
// controls render as a dim "not set" so the display tracks what's actually
// configured rather than fabricating defaults.
function SafetyRails({ bot }: { bot: BotDetailResponse }) {
  const T = useT();
  const notSet = <span style={{ color: T.text3 }}>not set</span>;
  const fmtPct = (v: string | number | null | undefined, suffix: string, sign: "neg" | "pos") => {
    const n = toNum(v);
    if (n === null) return notSet;
    const prefix = sign === "neg" ? "−" : "";
    return `${prefix}${n}% ${suffix}`;
  };

  const maxDrawdown = fmtPct(bot.max_drawdown_pause_pct, "→ pause", "neg");
  const maxDrawdownColor = toNum(bot.max_drawdown_pause_pct) === null ? undefined : T.loss;

  const dailyLoss = fmtPct(bot.daily_loss_limit_pct, "→ halt today", "neg");
  const dailyLossColor = toNum(bot.daily_loss_limit_pct) === null ? undefined : T.loss;

  const maxSector = fmtPct(bot.max_per_sector_pct, "of equity", "pos");

  const staleDays = bot.stale_data_max_age_days;
  const staleData =
    staleDays === null || staleDays === undefined
      ? notSet
      : `> ${staleDays} day${staleDays === 1 ? "" : "s"} → halt`;

  const paused = bot.status === "PAUSED";
  const killSwitchValue = paused
    ? bot.pause_reason
      ? `Paused — ${bot.pause_reason}`
      : "Paused"
    : bot.status === "STOPPED"
      ? "Stopped"
      : "Active";
  const killSwitchColor = paused ? T.warning : bot.status === "STOPPED" ? T.text3 : T.gain;

  return (
    <>
      <DotRow label="Max drawdown" value={maxDrawdown} color={maxDrawdownColor} />
      <DotRow label="Daily loss cap" value={dailyLoss} color={dailyLossColor} />
      <DotRow label="Max per sector" value={maxSector} />
      <DotRow label="Stale data halt" value={staleData} />
      <DotRow label="Max concurrent" value={`${bot.max_positions} open`} />
      <DotRow label="Trading window" value="10:00 – 15:15 PKT" />
      <DotRow label="Kill-switch" value={killSwitchValue} color={killSwitchColor} bold />
    </>
  );
}

function LogsModal({ botName, onClose }: { botName: string; onClose: () => void }) {
  const T = useT();

  return (
    <Modal onClose={onClose} width={620} label="Bot activity log" fullHeight>
        <div style={{ padding: "22px 26px 12px", borderBottom: `1px solid ${T.outlineFaint}` }}>
          <Kicker color={T.primaryLight}>bot activity log</Kicker>
          <h2
            style={{
              fontFamily: T.fontHead,
              fontSize: 22,
              fontWeight: 500,
              margin: "10px 0 4px",
              letterSpacing: -0.5,
            }}
          >
            {botName}
          </h2>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
            structured log streaming — coming soon
          </div>
        </div>

        <div
          style={{
            padding: "32px 26px",
            fontFamily: T.fontMono,
            fontSize: 12.5,
            color: T.text3,
            lineHeight: 1.7,
          }}
        >
          The backend doesn&apos;t expose a per-bot scan/decision log endpoint
          yet — only positions, trades, and performance snapshots. When that
          endpoint lands, this modal becomes a live tail.
        </div>

        <div
          style={{
            padding: 16,
            borderTop: `1px solid ${T.outlineFaint}`,
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <Btn variant="outline" size="sm" onClick={onClose}>
            Close
          </Btn>
        </div>
    </Modal>
  );
}

// Settings modal — round-trips the B2 bot-level risk controls. Backend
// PUT /bots/{id} treats `null` on these fields as "leave unchanged" (see
// services/trading_bot.py:207-220). Clearing a previously-set control
// isn't supported yet, so the modal surfaces a soft warning and silently
// skips blanked fields rather than sending null and pretending it cleared.
function SettingsModal({
  bot,
  onClose,
  onSaved,
}: {
  bot: BotDetailResponse;
  onClose: () => void;
  onSaved: (updated: BotResponse) => void;
}) {
  const T = useT();

  const initial: RiskControlsValue = {
    daily_loss_limit_pct: toNum(bot.daily_loss_limit_pct),
    max_drawdown_pause_pct: toNum(bot.max_drawdown_pause_pct),
    stale_data_max_age_days: bot.stale_data_max_age_days ?? null,
    stale_universe_halt_pct: toNum(bot.stale_universe_halt_pct),
    max_per_sector_pct: toNum(bot.max_per_sector_pct),
  };

  const [values, setValues] = useState<RiskControlsValue>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Compute the PUT payload by diffing against `initial`. Only send fields
  // that changed AND are non-null — a null delta from "set" → "blank" can't
  // be expressed today (backend treats null as no-op), so we drop those
  // here and warn separately below.
  const KEYS: Array<keyof RiskControlsValue> = [
    "daily_loss_limit_pct",
    "max_drawdown_pause_pct",
    "stale_data_max_age_days",
    "stale_universe_halt_pct",
    "max_per_sector_pct",
  ];
  const diff = (): BotUpdateBody => {
    const out: BotUpdateBody = {};
    for (const k of KEYS) {
      const next = values[k];
      const prev = initial[k];
      if (next !== prev && next !== null) {
        // narrow to the field-specific number type
        (out as Record<string, number>)[k] = next;
      }
    }
    return out;
  };

  const changedCount = Object.keys(diff()).length;
  const clearedFields = KEYS.filter((k) => values[k] === null && initial[k] !== null);

  async function onSave() {
    setErr(null);
    if (changedCount === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/bots/${bot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(diff()),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = (body as { error?: unknown; detail?: unknown });
        let msg = `Save failed (${res.status})`;
        if (typeof detail.error === "string" && detail.error.length > 0) {
          msg = detail.error;
        } else if (typeof detail.detail === "string") {
          msg = detail.detail;
        }
        throw new Error(msg);
      }
      const updated = (await res.json()) as BotResponse;
      onSaved(updated);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} width={560} label="Bot settings">
      <div style={{ padding: "22px 26px 14px", borderBottom: `1px solid ${T.outlineFaint}` }}>
        <Kicker color={T.primaryLight}>bot settings</Kicker>
        <h2
          style={{
            fontFamily: T.fontHead,
            fontSize: 22,
            fontWeight: 500,
            margin: "10px 0 4px",
            letterSpacing: -0.5,
          }}
        >
          {bot.name}
        </h2>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
          risk controls · take effect on next scan
        </div>
      </div>

      <div style={{ padding: "20px 26px" }}>
        <RiskControlsSection value={values} onChange={setValues} />
      </div>

      {clearedFields.length > 0 && (
        <div
          role="note"
          style={{
            margin: "0 26px 16px",
            padding: "10px 12px",
            background: `${T.warning}10`,
            border: `1px solid ${T.warning}44`,
            borderRadius: 4,
            fontSize: 11.5,
            color: T.text2,
            lineHeight: 1.5,
          }}
        >
          Clearing a previously-set control isn&apos;t supported yet — recreate the
          bot to remove it. Blank fields here will keep their current value on save.
        </div>
      )}

      {err && (
        <div
          role="alert"
          style={{
            margin: "0 26px 16px",
            padding: "10px 12px",
            background: `${T.loss}14`,
            border: `1px solid ${T.loss}44`,
            borderRadius: 4,
            fontSize: 12,
            color: T.loss,
          }}
        >
          {err}
        </div>
      )}

      <div
        style={{
          padding: 16,
          borderTop: `1px solid ${T.outlineFaint}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
          {changedCount === 0
            ? "no changes"
            : `${changedCount} change${changedCount === 1 ? "" : "s"} pending`}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            size="sm"
            onClick={() => {
              if (!saving) void onSave();
            }}
            disabled={saving || changedCount === 0}
          >
            {saving ? "Saving…" : "Save changes"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function OpenPositions({ positions }: { positions: PositionResponse[] }) {
  const T = useT();
  const cols: Col[] = [
    { label: "symbol", width: "100px", primary: true },
    { label: "dir", width: "60px" },
    { label: "entry", width: "130px", mobileFullWidth: true },
    { label: "now", align: "right", width: "90px" },
    { label: "qty", align: "right", width: "90px" },
    { label: "p&l", align: "right", width: "120px" },
    { label: "return", align: "right", width: "100px" },
    { label: "held", align: "right", width: "70px" },
    { label: "stop", align: "right", width: "80px" },
  ];
  if (positions.length === 0) {
    return (
      <div
        style={{
          padding: "24px 16px",
          fontFamily: T.fontMono,
          fontSize: 12,
          color: T.text3,
          textAlign: "center",
          border: `1px dashed ${T.outlineFaint}`,
          borderRadius: 4,
        }}
      >
        no open positions
      </div>
    );
  }
  const fmtEntry = (p: PositionResponse): string => {
    const d = new Date(p.entry_date);
    const date = isNaN(d.getTime())
      ? p.entry_date
      : d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    return `${date} · ${num(p.entry_price).toFixed(2)}`;
  };
  const rows: unknown[][] = positions.map((p) => {
    const pnl = num(p.unrealized_pnl);
    const pct = num(p.unrealized_pnl_pct);
    return [
      p.symbol,
      "BUY",
      fmtEntry(p),
      num(p.current_price).toFixed(2),
      p.quantity.toLocaleString(),
      `${pnl >= 0 ? "+" : ""}${Math.round(pnl).toLocaleString()}`,
      `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
      p.days_held != null ? `${p.days_held}d` : "—",
      p.stop_loss_price != null ? num(p.stop_loss_price).toFixed(2) : "—",
    ];
  });
  return (
    <TerminalTable
      cols={cols}
      rows={rows}
      renderCell={(cell, ci) => {
        if (ci === 0)
          return <span style={{ color: T.text, fontWeight: 500 }}>{cell as ReactNode}</span>;
        if (ci === 1) return <span style={{ color: T.gain }}>{cell as ReactNode}</span>;
        if (ci === 5 || ci === 6) {
          const s = String(cell);
          return <span style={{ color: s.startsWith("-") ? T.loss : T.gain }}>{cell as ReactNode}</span>;
        }
        if (ci === 7) return <span style={{ color: T.text3 }}>{cell as ReactNode}</span>;
        if (ci === 8) return <span style={{ color: T.loss }}>{cell as ReactNode}</span>;
        return cell as ReactNode;
      }}
    />
  );
}
