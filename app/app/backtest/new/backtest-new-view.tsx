"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DayPicker } from "react-day-picker";
import { parseISO } from "date-fns";
import "react-day-picker/style.css";
import "@/components/calendar.css";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import {
  Btn,
  EditorialHeader,
  FlashToast,
  Kicker,
  useFlash,
} from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick } from "@/components/responsive";
import type {
  StrategyStatus,
  BacktestJobPending,
  BacktestJobStatus,
  BacktestResultResponse,
} from "@/lib/api/strategies";

export interface StrategyOption {
  id: number;
  name: string;
  status: StrategyStatus;
}

// Local-time YYYY-MM-DD (avoids the UTC drift of toISOString in PKT).
function isoLocal(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
}
function todayIso(): string {
  return isoLocal(new Date());
}

type PresetKey = "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "ALL" | "CUSTOM";
const PRESET_ORDER: PresetKey[] = ["1M", "3M", "6M", "YTD", "1Y", "3Y", "ALL", "CUSTOM"];
const PRESET_LABEL: Record<PresetKey, string> = {
  "1M": "1M",
  "3M": "3M",
  "6M": "6M",
  "YTD": "YTD",
  "1Y": "1Y",
  "3Y": "3Y",
  "ALL": "All",
  "CUSTOM": "Custom",
};

function presetRange(key: Exclude<PresetKey, "CUSTOM">): { start: string; end: string } {
  const today = new Date();
  const end = isoLocal(today);
  const start = new Date(today);
  switch (key) {
    case "1M":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3M":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6M":
      start.setMonth(start.getMonth() - 6);
      break;
    case "YTD":
      start.setMonth(0);
      start.setDate(1);
      break;
    case "1Y":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "3Y":
      start.setFullYear(start.getFullYear() - 3);
      break;
    case "ALL":
      // 10y back is more than the deepest history we expect to have on PSX
      // and stays bounded so the backend isn't asked for forever.
      start.setFullYear(start.getFullYear() - 10);
      break;
  }
  return { start: isoLocal(start), end };
}

function detectActivePreset(startDate: string, endDate: string): PresetKey {
  if (endDate !== todayIso()) return "CUSTOM";
  for (const k of PRESET_ORDER) {
    if (k === "CUSTOM") continue;
    const r = presetRange(k);
    if (r.start === startDate && r.end === endDate) return k;
  }
  return "CUSTOM";
}

function formatPickerLabel(iso: string): string {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BacktestNewView({
  strategies,
  initialStrategyId,
  initialStart,
  initialEnd,
}: {
  strategies: StrategyOption[];
  initialStrategyId: number | null;
  initialStart: string | null;
  initialEnd: string | null;
}) {
  const T = useT();
  const router = useRouter();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const { flash, setFlash } = useFlash();

  // If the URL ships a strategy_id that's not in the user's list (deleted,
  // wrong tenant, etc.), fall back to no selection so the picker shows.
  const pickedStrategyExists =
    initialStrategyId != null &&
    strategies.some((s) => s.id === initialStrategyId);
  const [strategyId, setStrategyId] = useState<number | null>(
    pickedStrategyExists ? initialStrategyId : null,
  );

  // Initial range: prefill from query (re-run flow), else 1M preset.
  const defaultRange = presetRange("1M");
  const [startDate, setStartDate] = useState<string>(
    initialStart ?? defaultRange.start,
  );
  const [endDate, setEndDate] = useState<string>(
    initialEnd ?? defaultRange.end,
  );

  const [running, setRunning] = useState(false);

  const selectedStrategy = strategies.find((s) => s.id === strategyId) ?? null;

  async function pollJob(stratId: number, jobId: string): Promise<BacktestJobStatus> {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await fetch(`/api/strategies/${stratId}/backtest/job/${jobId}`);
      if (!res.ok) throw new Error(`Poll failed (${res.status})`);
      const status = (await res.json()) as BacktestJobStatus;
      if (status.status === "completed" || status.status === "failed") return status;
    }
    throw new Error("Backtest taking longer than expected — try again later.");
  }

  async function handleRun() {
    if (running) return;
    if (!strategyId) {
      setFlash("Pick a strategy before running.");
      return;
    }
    if (!startDate || !endDate) {
      setFlash("Pick a from / to date range before running.");
      return;
    }
    if (startDate >= endDate) {
      setFlash("From date must be before to date.");
      return;
    }
    if (endDate > todayIso()) {
      setFlash("To date cannot be in the future.");
      return;
    }
    const minSpanMs = 7 * 24 * 60 * 60 * 1000;
    if (new Date(endDate).getTime() - new Date(startDate).getTime() < minSpanMs) {
      setFlash("Date range must span at least 7 days.");
      return;
    }
    setRunning(true);
    try {
      const startRes = await fetch(`/api/strategies/${strategyId}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          initial_capital: 1_000_000,
        }),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        if (startRes.status === 403) throw new Error("Backtests require the Pro plan.");
        throw new Error(
          typeof err?.error === "string" ? err.error : `Start failed (${startRes.status})`,
        );
      }
      const started = (await startRes.json()) as
        | BacktestJobPending
        | BacktestResultResponse;

      // Sync mode (Redis off): backend returns the full result inline. Use
      // its id straight away for the redirect.
      if (!("job_id" in started)) {
        router.push(
          `/backtest?strategy_id=${strategyId}&backtest_id=${started.id}`,
        );
        return;
      }

      const final = await pollJob(strategyId, started.job_id);
      if (final.status === "failed") {
        throw new Error(final.error ?? "Backtest failed");
      }
      if (final.backtest_id) {
        router.push(
          `/backtest?strategy_id=${strategyId}&backtest_id=${final.backtest_id}`,
        );
      } else {
        // Shouldn't happen — completed without a backtest_id. Fall back to
        // the per-strategy results page which auto-loads the latest run.
        router.push(`/backtest?strategy_id=${strategyId}`);
      }
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Backtest failed");
      setRunning(false);
    }
  }

  const empty = strategies.length === 0;

  return (
    <AppFrame route="/backtest">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorialHeader
          kicker={
            <>
              <Link href="/backtest" style={{ color: T.primaryLight }}>
                Backtest
              </Link>{" "}
              / <span style={{ color: T.text2 }}>new run</span>
            </>
          }
          title={
            <>
              <span style={{ fontWeight: 400, color: T.text2 }}>Run a</span>{" "}
              <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>
                backtest
              </span>
            </>
          }
          meta={
            empty ? (
              <span>no strategies yet — build one to backtest it</span>
            ) : selectedStrategy ? (
              <>
                <span>{selectedStrategy.name}</span>
                <span style={{ color: T.text3 }}>
                  universe + filters set on the strategy itself
                </span>
              </>
            ) : (
              <span>pick a strategy and a date range, then run</span>
            )
          }
          actions={
            <Link href="/backtest" style={{ textDecoration: "none" }}>
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
          }}
        >
          {empty ? (
            <EmptyState />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 28,
                maxWidth: 760,
              }}
            >
              <StrategyPicker
                strategies={strategies}
                value={strategyId}
                onChange={setStrategyId}
                disabled={running}
              />

              <DateRangeBlock
                startDate={startDate}
                endDate={endDate}
                onStart={setStartDate}
                onEnd={setEndDate}
                disabled={running}
              />

              <UniverseNote selectedStrategy={selectedStrategy} />

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <Btn
                  variant="primary"
                  size="md"
                  icon={Icon.spark}
                  onClick={handleRun}
                  disabled={running || !strategyId}
                >
                  {running ? "Running…" : "Run backtest"}
                </Btn>
                <Link href="/backtest" style={{ textDecoration: "none" }}>
                  <Btn variant="ghost" size="md" disabled={running}>
                    Cancel
                  </Btn>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      {flash && <FlashToast message={flash} />}
    </AppFrame>
  );
}

function EmptyState() {
  const T = useT();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 14,
        padding: "32px 0",
        maxWidth: 560,
      }}
    >
      <div
        style={{
          fontFamily: T.fontMono,
          fontSize: 12,
          color: T.text3,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        nothing to backtest yet
      </div>
      <div style={{ fontSize: 15, color: T.text2, lineHeight: 1.55 }}>
        Backtests run against strategies — the entry/exit rules you author
        over on{" "}
        <Link href="/strategies" style={{ color: T.primaryLight }}>
          Strategies
        </Link>
        . Build one first, then come back here to validate it against
        historical PSX data.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <Link href="/strategies/new" style={{ textDecoration: "none" }}>
          <Btn variant="primary" size="sm" icon={Icon.plus}>
            Build a strategy
          </Btn>
        </Link>
      </div>
    </div>
  );
}

function StrategyPicker({
  strategies,
  value,
  onChange,
  disabled,
}: {
  strategies: StrategyOption[];
  value: number | null;
  onChange: (id: number) => void;
  disabled: boolean;
}) {
  const T = useT();
  const statusTint = (s: StrategyStatus) => {
    if (s === "ACTIVE") return T.deploy;
    if (s === "PAUSED") return T.warning;
    if (s === "ARCHIVED") return T.text3;
    return T.text3; // DRAFT
  };
  return (
    <div>
      <Kicker>strategy</Kicker>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {strategies.map((s) => {
          const active = s.id === value;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              disabled={disabled}
              aria-pressed={active}
              style={{
                background: active ? T.surface3 : "transparent",
                color: active ? T.text : T.text2,
                border: `1px solid ${active ? T.outlineVariant : T.outlineFaint}`,
                borderRadius: 4,
                padding: "8px 14px",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                fontFamily: "inherit",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition:
                  "background 120ms ease, color 120ms ease, border-color 120ms ease",
              }}
            >
              <span>{s.name}</span>
              <span
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 9.5,
                  color: statusTint(s.status),
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                {s.status.toLowerCase()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DateRangeBlock({
  startDate,
  endDate,
  onStart,
  onEnd,
  disabled,
}: {
  startDate: string;
  endDate: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  disabled: boolean;
}) {
  const T = useT();
  // Sticky-custom: once the user explicitly clicks Custom, stay there even
  // if the typed dates happen to align with a preset. This matches the old
  // backtest-view behavior so muscle memory is preserved.
  const [customSticky, setCustomSticky] = useState(() =>
    detectActivePreset(startDate, endDate) === "CUSTOM",
  );
  const detected = detectActivePreset(startDate, endDate);
  const active: PresetKey = customSticky ? "CUSTOM" : detected;

  const handlePresetClick = (key: PresetKey) => {
    if (disabled) return;
    if (key === "CUSTOM") {
      setCustomSticky(true);
      return;
    }
    setCustomSticky(false);
    const r = presetRange(key);
    onStart(r.start);
    onEnd(r.end);
  };

  const chipStyle = (isActive: boolean): CSSProperties => ({
    background: isActive ? T.surface3 : "transparent",
    color: isActive ? T.text : T.text2,
    border: `1px solid ${isActive ? T.outlineVariant : T.outlineFaint}`,
    borderRadius: 3,
    padding: "5px 11px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: T.fontMono,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
  });

  return (
    <div>
      <Kicker>date range</Kicker>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PRESET_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handlePresetClick(k)}
              disabled={disabled}
              style={chipStyle(active === k)}
            >
              {PRESET_LABEL[k]}
            </button>
          ))}
        </div>
        {active === "CUSTOM" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginLeft: 4,
            }}
          >
            <DateTrigger
              label="from"
              iso={startDate}
              onChange={onStart}
              disabledAfter={endDate}
            />
            <span style={{ color: T.text3 }}>→</span>
            <DateTrigger
              label="to"
              iso={endDate}
              onChange={onEnd}
              disabledBefore={startDate}
              disabledAfter={todayIso()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DateTrigger({
  label,
  iso,
  onChange,
  disabledBefore,
  disabledAfter,
}: {
  label: string;
  iso: string;
  onChange: (v: string) => void;
  disabledBefore?: string;
  disabledAfter?: string;
}) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = iso ? parseISO(iso) : undefined;
  const disabledMatchers: Array<{ before: Date } | { after: Date }> = [];
  if (disabledBefore) disabledMatchers.push({ before: parseISO(disabledBefore) });
  if (disabledAfter) disabledMatchers.push({ after: parseISO(disabledAfter) });

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <span style={{ color: T.text3, marginRight: 6, fontFamily: T.fontMono, fontSize: 11 }}>{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "transparent",
          color: T.text,
          border: "none",
          borderBottom: `1px dashed ${T.outlineVariant}`,
          padding: "3px 2px 2px",
          fontFamily: T.fontMono,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {formatPickerLabel(iso)}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            background: T.surfaceLow,
            border: `1px solid ${T.outlineVariant}`,
            borderRadius: 4,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            animation: "psx-pop-in 140ms ease-out",
          }}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (d) {
                onChange(isoLocal(d));
                setOpen(false);
              }
            }}
            disabled={disabledMatchers.length ? disabledMatchers : undefined}
            defaultMonth={selected}
            weekStartsOn={1}
            showOutsideDays
          />
        </div>
      )}
    </div>
  );
}

function UniverseNote({
  selectedStrategy,
}: {
  selectedStrategy: StrategyOption | null;
}) {
  const T = useT();
  return (
    <div
      style={{
        padding: "12px 14px",
        background: T.surfaceLow,
        border: `1px dashed ${T.outlineFaint}`,
        borderRadius: 4,
        fontSize: 12.5,
        color: T.text2,
        lineHeight: 1.55,
        maxWidth: 620,
      }}
    >
      <span style={{ color: T.text3, fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase", marginRight: 8 }}>
        universe
      </span>
      Bound to the strategy&rsquo;s own filters and symbol list — edit those on{" "}
      {selectedStrategy ? (
        <Link
          href={`/strategies/${selectedStrategy.id}`}
          style={{ color: T.primaryLight }}
        >
          its editor
        </Link>
      ) : (
        <Link href="/strategies" style={{ color: T.primaryLight }}>
          the strategy editor
        </Link>
      )}{" "}
      if you need a different basket. Initial capital defaults to{" "}
      <span style={{ color: T.text }}>PKR 1,000,000</span>.
    </div>
  );
}
