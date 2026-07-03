"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import {
  Btn,
  EditorialHeader,
  FlashToast,
  Kicker,
  Lede,
  TerminalTable,
  useFlash,
  type Col,
} from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick, clampPx } from "@/components/responsive";

type StatusFilter = "all" | "running" | "paused" | "archived";

// Bots have no backend "archived" state (their statuses are ACTIVE/PAUSED/
// STOPPED), so the Archived bucket is tracked client-side: the set of archived
// bot ids is persisted here and hydrated on mount. Archiving stops the bot;
// restoring just un-hides it (it stays stopped) — matching how the strategies
// page restores to a non-live state.
const ARCHIVE_KEY = "psx:bots:archivedIds";
const ARCHIVE_SKIP_KEY = "psx:bots:skipArchiveConfirm";

interface Bot {
  id: string;
  name: string;
  strat: string;
  // null when the underlying strategy has been soft-deleted
  stratId: string | null;
  status: "RUNNING" | "PAUSED" | "STOPPED";
  equity: number;
  start: number;
  pnl: number;
  today: number;
  open: number;
  trades: number;
  uptime: string;
  // Client-only flag — see ARCHIVE_KEY. Undefined/false = lives in the main
  // list; true = sits in the Archived bucket, out of the active view.
  archived?: boolean;
}

export function BotsView({
  initialBots,
  fetchFailed = false,
}: {
  initialBots: Bot[];
  fetchFailed?: boolean;
}) {
  const [bots, setBots] = useState<Bot[]>(initialBots);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [archiveTarget, setArchiveTarget] = useState<Bot | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  // Whether the user has opted out of the archive-confirm modal. The modal
  // still appears unconditionally when the bot is running (the stop warning is
  // load-bearing). Read from localStorage once on mount.
  const [skipArchiveConfirm, setSkipArchiveConfirm] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const { flash, setFlash } = useFlash();

  // Hydrate the archived bucket + skip-confirm preference from localStorage —
  // the server render can't know either, so the page paints "live" first and
  // tucks archived bots away on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ARCHIVE_KEY);
      if (raw) {
        const ids = new Set<string>(JSON.parse(raw) as string[]);
        if (ids.size) {
          setBots((prev) => prev.map((b) => (ids.has(b.id) ? { ...b, archived: true } : b)));
        }
      }
      setSkipArchiveConfirm(localStorage.getItem(ARCHIVE_SKIP_KEY) === "1");
    } catch {
      // Private mode / storage disabled — default to no archived bots.
    }
  }, []);

  useEffect(() => {
    if (fetchFailed) setFlash("Couldn't load your bots — showing empty list");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFailed]);

  // Auto-dismiss the inline archive/restore message.
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  function persistArchived(mutate: (ids: Set<string>) => void) {
    try {
      const raw = localStorage.getItem(ARCHIVE_KEY);
      const ids = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      mutate(ids);
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...ids]));
    } catch {
      // Storage disabled — the change still applies in-session via React state.
    }
  }

  async function performArchive(b: Bot) {
    if (archiveBusy) return;
    setArchiveBusy(true);
    try {
      // Archiving takes the bot out of active rotation, so stop it first. A bot
      // that's already stopped just moves to the bucket — no redundant call.
      if (b.status !== "STOPPED") {
        const res = await fetch(`/api/bots/${b.id}/stop`, { method: "POST" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
      }
      setBots((prev) =>
        prev.map((r) => (r.id === b.id ? { ...r, archived: true, status: "STOPPED" } : r)),
      );
      persistArchived((ids) => ids.add(b.id));
      setMsg({ kind: "ok", text: `archived "${b.name}"` });
      setArchiveTarget(null);
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "archive failed" });
    } finally {
      setArchiveBusy(false);
    }
  }

  // Restore just un-hides the bot — it stays stopped (start it again from its
  // page if you want it trading). No backend call: the bot is already stopped.
  function performRestore(b: Bot) {
    setBots((prev) => prev.map((r) => (r.id === b.id ? { ...r, archived: false } : r)));
    persistArchived((ids) => ids.delete(b.id));
    setMsg({ kind: "ok", text: `restored "${b.name}"` });
  }

  const liveBots = bots.filter((b) => !b.archived);

  return (
    <AppFrame route="/bots">
      <Body
        bots={bots}
        liveBots={liveBots}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        msg={msg}
        onArchive={(b) => {
          // Bypass the modal only when the user opted out AND the bot isn't
          // running — a running bot being stopped is always worth a confirm.
          if (skipArchiveConfirm && b.status !== "RUNNING") {
            void performArchive(b);
            return;
          }
          setArchiveTarget(b);
        }}
        onRestore={performRestore}
        archiveBusy={archiveBusy}
        archiveBusyId={archiveTarget?.id ?? null}
      />
      {archiveTarget && (
        <ArchiveConfirmModal
          bot={archiveTarget}
          busy={archiveBusy}
          skipConfirm={skipArchiveConfirm}
          onSkipConfirmChange={(v) => {
            setSkipArchiveConfirm(v);
            try {
              if (v) localStorage.setItem(ARCHIVE_SKIP_KEY, "1");
              else localStorage.removeItem(ARCHIVE_SKIP_KEY);
            } catch {
              // Storage disabled — preference still applies in-session.
            }
          }}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => performArchive(archiveTarget)}
        />
      )}
      {flash && <FlashToast message={flash} />}
    </AppFrame>
  );
}

function Body({
  bots,
  liveBots,
  statusFilter,
  setStatusFilter,
  msg,
  onArchive,
  onRestore,
  archiveBusy,
  archiveBusyId,
}: {
  bots: Bot[];
  liveBots: Bot[];
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  msg: { kind: "ok" | "err"; text: string } | null;
  onArchive: (b: Bot) => void;
  onRestore: (b: Bot) => void;
  archiveBusy: boolean;
  archiveBusyId: string | null;
}) {
  const T = useT();
  // Page-level empty state only when the user owns no bots at all. If every bot
  // is archived, we still render Populated so the Archived filter is reachable.
  const empty = bots.length === 0;
  const runningCount = liveBots.filter((b) => b.status === "RUNNING").length;
  const totalEquity = liveBots.reduce((s, b) => s + b.equity, 0);
  const todayTotal = liveBots.reduce((s, b) => s + b.today, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <EditorialHeader
        kicker="Automation · paper-trading runners"
        title={
          <>
            Bots{" "}
            <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>·</span>{" "}
            {empty ? (
              <span style={{ color: T.text3, fontWeight: 400, fontSize: "0.7em" }}>no bots yet</span>
            ) : (
              `${liveBots.length} total`
            )}
          </>
        }
        meta={
          empty ? (
            <>
              <span>0 running</span>
              <span>PKR 0 managed</span>
            </>
          ) : (
            <>
              <span>
                <span style={{ color: runningCount > 0 ? T.gain : T.text3 }}>●</span> {runningCount} running
              </span>
              <span>PKR {(totalEquity / 1_000_000).toFixed(2)}M managed</span>
              <span style={{ color: todayTotal >= 0 ? T.gain : T.loss }}>
                {todayTotal >= 0 ? "+" : ""}
                PKR {todayTotal.toLocaleString()} today
              </span>
              <span style={{ color: T.text3 }}>paper-trading · no real broker</span>
            </>
          )
        }
        actions={
          <>
            {msg && (
              <span
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  color: msg.kind === "ok" ? T.gain : T.loss,
                }}
              >
                {msg.text}
              </span>
            )}
            {!empty ? (
              <Link href="/bots/new" style={{ textDecoration: "none" }}>
                <Btn variant="primary" size="sm" icon={Icon.plus} style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.14)" }}>
                  Create bot
                </Btn>
              </Link>
            ) : null}
          </>
        }
      />

      {empty ? (
        <EmptyState />
      ) : (
        <Populated
          bots={bots}
          liveBots={liveBots}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onArchive={onArchive}
          onRestore={onRestore}
          archiveBusy={archiveBusy}
          archiveBusyId={archiveBusyId}
        />
      )}
    </div>
  );
}

function Populated({
  bots,
  liveBots,
  statusFilter,
  setStatusFilter,
  onArchive,
  onRestore,
  archiveBusy,
  archiveBusyId,
}: {
  bots: Bot[];
  liveBots: Bot[];
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  onArchive: (b: Bot) => void;
  onRestore: (b: Bot) => void;
  archiveBusy: boolean;
  archiveBusyId: string | null;
}) {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  // Shrink the big stat numbers on phones so "PKR 9.00M" fits on one line
  // (was wrapping at 40px) and the summary block takes less vertical space —
  // less scrolling. Scales with viewport so it fits even on narrow (320px)
  // phones; tablet/desktop keep the original fixed 40px.
  const ledeSize = pick(bp, { mobile: clampPx(20, 6.5, 30), desktop: "40px" });
  // Lede card values — all derived from the live (non-archived) bots so the
  // summary tracks the active portfolio, not retired runners.
  const totalEquity = liveBots.reduce((s, b) => s + b.equity, 0);
  const totalStart = liveBots.reduce((s, b) => s + b.start, 0);
  const combinedAbs = totalEquity - totalStart;
  const combinedPct = totalStart > 0 ? (combinedAbs / totalStart) * 100 : 0;
  const todayTotal = liveBots.reduce((s, b) => s + b.today, 0);
  const openTotal = liveBots.reduce((s, b) => s + b.open, 0);

  const archivedBots = bots.filter((b) => b.archived);
  const counts = {
    all: liveBots.length,
    running: liveBots.filter((b) => b.status === "RUNNING").length,
    paused: liveBots.filter((b) => b.status === "PAUSED").length,
    archived: archivedBots.length,
  };
  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "all", count: counts.all },
    { key: "running", label: "running", count: counts.running },
    { key: "paused", label: "paused", count: counts.paused },
    { key: "archived", label: "archived", count: counts.archived },
  ];

  // "all" shows every live bot (running/paused/stopped-not-archived); the
  // status pills narrow within live; "archived" swaps to the bucket.
  const visible =
    statusFilter === "all"
      ? liveBots
      : statusFilter === "archived"
      ? archivedBots
      : liveBots.filter((b) => b.status === (statusFilter.toUpperCase() as Bot["status"]));

  // Archive (or Restore, for already-archived rows) action button. Shared by
  // the desktop trailing-column cell and the mobile name-row cell so the busy
  // state stays identical in both layouts.
  const renderArchiveBtn = (b: Bot) => {
    const isArchived = !!b.archived;
    const busy = !isArchived && archiveBusy && archiveBusyId === b.id;
    return (
      <Btn
        variant="ghost"
        size="sm"
        disabled={busy}
        title={isArchived ? "Restore" : "Archive"}
        icon={busy ? undefined : isArchived ? Icon.arrowR : Icon.archive}
        onClick={() => {
          if (isArchived) onRestore(b);
          else onArchive(b);
        }}
      >
        {busy ? "…" : null}
      </Btn>
    );
  };

  const cols: Col[] = [
    { label: "name", width: "1.4fr", mono: false, primary: true },
    { label: "strategy", width: "1.2fr", mono: false, mobileFullWidth: true },
    { label: "status", width: "100px" },
    { label: "equity", align: "right", width: "140px" },
    { label: "p&l", align: "right", width: "90px" },
    { label: "today", align: "right", width: "110px" },
    { label: "open", align: "right", width: "60px" },
    { label: "trades", align: "right", width: "70px" },
    { label: "uptime", align: "right", width: "80px" },
    // Trailing Archive / Restore action. Hidden on mobile — there it folds into
    // the top-right of the name cell instead of taking a full-width row.
    { label: "", align: "right", width: "90px", hideOnMobile: true },
  ];
  const rows: unknown[][] = visible.map((b) => [
    b,
    b.strat,
    b.status,
    b.equity,
    b.pnl,
    b.today,
    b.open,
    b.trades,
    b.uptime,
    b,
  ]);

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: pick(bp, {
          mobile: `18px ${padX} 28px`,
          desktop: `24px ${padX} 40px`,
        }),
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: pick(bp, {
            mobile: "1fr 1fr",
            tablet: "repeat(2, 1fr)",
            desktop: "repeat(4, 1fr)",
          }),
          gap: pick(bp, { mobile: "16px 20px", desktop: "36px" }),
          paddingBottom: 24,
          borderBottom: `1px solid ${T.outlineFaint}`,
        }}
      >
        <Lede
          label="Total equity"
          value={`PKR ${(totalEquity / 1_000_000).toFixed(2)}M`}
          sub={`across ${liveBots.length} bot${liveBots.length === 1 ? "" : "s"}`}
          size={ledeSize}
        />
        <Lede
          label="Combined P&L"
          value={`${combinedPct >= 0 ? "+" : ""}${combinedPct.toFixed(2)}%`}
          color={combinedPct >= 0 ? T.gain : T.loss}
          sub={`${combinedAbs >= 0 ? "+" : ""}PKR ${Math.round(combinedAbs).toLocaleString()}`}
          size={ledeSize}
        />
        <Lede
          label="Today"
          value={`${todayTotal >= 0 ? "+" : ""}PKR ${todayTotal.toLocaleString()}`}
          color={todayTotal >= 0 ? T.gain : T.loss}
          sub="unrealized"
          size={ledeSize}
        />
        <Lede
          label="Open positions"
          value={String(openTotal)}
          sub={openTotal === 0 ? "no live trades" : "across all bots"}
          size={ledeSize}
        />
      </div>

      <div
        style={{
          marginTop: 26,
          display: "flex",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? 10 : 18,
          paddingBottom: 14,
          borderBottom: `1px solid ${T.outlineFaint}`,
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 8 }}>
          <Kicker>filter</Kicker>
          {filters.map((f) => (
            <FilterPill
              key={f.key}
              active={statusFilter === f.key}
              onClick={() => setStatusFilter(f.key)}
              disabled={f.count === 0 && f.key !== "all"}
            >
              {f.label} {f.count}
            </FilterPill>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
          sort: <span style={{ color: T.text2 }}>P&amp;L ↓</span>
        </span>
      </div>

      <div style={{ marginTop: 18 }}>
        {visible.length === 0 ? (
          <FilteredEmpty
            label={filters.find((f) => f.key === statusFilter)?.label ?? "this filter"}
            archivedCount={statusFilter === "all" ? counts.archived : 0}
            onReset={() => setStatusFilter("all")}
            onShowArchived={() => setStatusFilter("archived")}
          />
        ) : (
          <TerminalTable
            cols={cols}
            rows={rows}
            renderCell={(cell, ci, ri) => {
              if (ci === 0) {
                const b = cell as Bot;
                const nameLink = (
                  <Link
                    href={`/bots/${b.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      textDecoration: "none",
                      // Mobile only: let the link shrink so the name can ellipsis
                      // beside the inline archive button.
                      ...(isMobile ? { minWidth: 0 } : {}),
                    }}
                  >
                    <span
                      style={{
                        fontFamily: T.fontHead,
                        fontSize: 14,
                        color: T.text,
                        fontWeight: 500,
                        letterSpacing: -0.2,
                        ...(isMobile
                          ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                          : {}),
                      }}
                    >
                      {b.name}
                    </span>
                  </Link>
                );
                if (!isMobile) return nameLink;
                // Mobile: park the archive/restore action at the top-right of the
                // name row so it no longer needs a full-width row of its own.
                return (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
                    {nameLink}
                    {renderArchiveBtn(b)}
                  </div>
                );
              }
              if (ci === 1) {
                const b = visible[ri];
                const name = cell as ReactNode;
                if (!b || !b.stratId) {
                  // Strategy is gone (soft-deleted on the backend) — show
                  // last-known name + a "(deleted)" badge instead of a link.
                  return (
                    <span style={{ color: T.text3 }}>
                      {name}{" "}
                      <span style={{ color: T.warning, fontSize: 10.5, letterSpacing: 0.4 }}>
                        (deleted)
                      </span>
                    </span>
                  );
                }
                return (
                  <Link
                    href={`/strategies/${b.stratId}`}
                    style={{ color: T.primaryLight, textDecoration: "none" }}
                  >
                    {name}
                  </Link>
                );
              }
              if (ci === 2) {
                const st = cell as Bot["status"];
                const c = { RUNNING: T.gain, PAUSED: T.warning, STOPPED: T.text3 }[st];
                return (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: c,
                      fontSize: 10.5,
                      letterSpacing: 0.6,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        background: c,
                        boxShadow: st === "RUNNING" ? `0 0 0 2px ${c}33` : undefined,
                      }}
                    />
                    {st.toLowerCase()}
                  </span>
                );
              }
              if (ci === 3)
                return (
                  <span style={{ color: T.text }}>
                    {((cell as number) / 1000).toFixed(1)}K
                  </span>
                );
              if (ci === 4) {
                const n = Number(cell);
                return (
                  <span style={{ color: n >= 0 ? T.gain : T.loss }}>
                    {n > 0 ? "+" : ""}
                    {n.toFixed(2)}%
                  </span>
                );
              }
              if (ci === 5) {
                const n = Number(cell);
                if (n === 0) return <span style={{ color: T.text3 }}>—</span>;
                return (
                  <span style={{ color: n >= 0 ? T.gain : T.loss }}>
                    {n > 0 ? "+" : ""}
                    {n.toLocaleString()}
                  </span>
                );
              }
              if (ci === 6)
                return (
                  <span style={{ color: Number(cell) > 0 ? T.text : T.text3 }}>
                    {cell as ReactNode}
                  </span>
                );
              if (ci === 7 || ci === 8)
                return <span style={{ color: T.text3 }}>{cell as ReactNode}</span>;
              if (ci === 9) return renderArchiveBtn(cell as Bot);
              return cell as ReactNode;
            }}
          />
        )}
      </div>

      <div
        style={{
          marginTop: 32,
          padding: 16,
          background: T.surfaceLow,
          border: `1px dashed ${T.outlineFaint}`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span style={{ fontFamily: T.fontHead, fontSize: 20, color: T.accent }}>◇</span>
        <div style={{ flex: 1, fontSize: 13, color: T.text2 }}>
          <span style={{ color: T.text, fontWeight: 500 }}>Want another bot?</span> Open a strategy
          and hit <span style={{ color: T.accent }}>Spin up bot</span>. Bots are always bound to a
          strategy — they don&apos;t exist on their own.
        </div>
        <Link href="/strategies" style={{ textDecoration: "none" }}>
          <Btn variant="ghost" size="sm">
            Browse strategies →
          </Btn>
        </Link>
      </div>
    </div>
  );
}

function FilterPill({
  children,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const T = useT();
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        fontSize: 11.5,
        fontFamily: T.fontMono,
        background: active ? T.surface3 : "transparent",
        color: active ? T.text : disabled ? T.text3 : T.text2,
        boxShadow: `0 0 0 1px ${active ? T.outlineVariant : T.outlineFaint}`,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 120ms ease, color 120ms ease",
      }}
    >
      {children}
    </button>
  );
}

function FilteredEmpty({
  onReset,
  label,
  archivedCount,
  onShowArchived,
}: {
  onReset: () => void;
  label: string;
  // When > 0, the user is on the "all" pill and every bot they own is archived.
  // Show a nudge to the archived pill instead of a useless "clear filter" CTA.
  archivedCount?: number;
  onShowArchived?: () => void;
}) {
  const T = useT();
  const allArchived = (archivedCount ?? 0) > 0;
  return (
    <div
      style={{
        padding: "48px 20px",
        textAlign: "center",
        color: T.text3,
        fontFamily: T.fontMono,
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        {allArchived ? (
          <>
            all {archivedCount} of your bots are{" "}
            <span style={{ color: T.text2 }}>archived</span>
          </>
        ) : (
          <>
            no bots match <span style={{ color: T.text2 }}>{label}</span>
          </>
        )}
      </div>
      {allArchived && onShowArchived ? (
        <Btn variant="ghost" size="sm" onClick={onShowArchived}>
          view archived
        </Btn>
      ) : (
        <Btn variant="ghost" size="sm" onClick={onReset}>
          clear filter
        </Btn>
      )}
    </div>
  );
}

function ArchiveConfirmModal({
  bot,
  busy,
  skipConfirm,
  onSkipConfirmChange,
  onCancel,
  onConfirm,
}: {
  bot: Bot;
  busy: boolean;
  skipConfirm: boolean;
  onSkipConfirmChange: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const T = useT();
  const isRunning = bot.status === "RUNNING";
  const titleId = "bot-archive-confirm-title";
  const cancelWrapRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // Land focus on Cancel so keyboard users start at the non-destructive
    // action. Escape also cancels (matches the backdrop click).
    cancelWrapRef.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface,
          border: `1px solid ${T.outline}`,
          borderRadius: 8,
          maxWidth: 460,
          width: "100%",
          padding: 24,
          fontFamily: T.fontSans,
        }}
      >
        <h2
          id={titleId}
          style={{
            margin: 0,
            fontFamily: T.fontHead,
            fontSize: 18,
            fontWeight: 600,
            color: T.text,
          }}
        >
          Archive this bot?
        </h2>
        <p style={{ marginTop: 12, color: T.text2, fontSize: 13, lineHeight: 1.5 }}>
          <span style={{ color: T.text }}>&ldquo;{bot.name}&rdquo;</span> will move to the Archived
          bucket, out of your main list. {isRunning ? "It is currently running, so" : "It is already stopped;"}{" "}
          archiving keeps it out of active rotation. You can restore it any time — it comes back
          stopped, and you start it again from its page.
        </p>
        {isRunning && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              border: `1px solid ${T.warning}`,
              borderRadius: 6,
              background: `${T.warning}11`,
              color: T.warning,
              fontSize: 12.5,
              lineHeight: 1.45,
            }}
          >
            This bot is running. Archiving stops it on the next cycle — it will stop opening and
            managing positions until you restore it and start it again.
          </div>
        )}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {isRunning ? (
            <span style={{ fontSize: 11, color: T.text3 }}>
              Stop warning shown because this bot is running.
            </span>
          ) : (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: T.text2,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={skipConfirm}
                onChange={(e) => onSkipConfirmChange(e.target.checked)}
                disabled={busy}
                style={{ accentColor: T.primary, cursor: busy ? "not-allowed" : "pointer" }}
              />
              Don&rsquo;t show this again
            </label>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <span ref={cancelWrapRef} style={{ display: "inline-flex" }}>
              <Btn variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
                Cancel
              </Btn>
            </span>
            <Btn variant="danger" size="sm" onClick={onConfirm} disabled={busy}>
              {busy ? "Archiving…" : "Archive"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: pick(bp, { mobile: `28px ${padX}`, desktop: `48px ${padX}` }),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 720, textAlign: "center" }}>
        <div style={{ fontFamily: T.fontHead, fontSize: clampPx(48, 14, 72), color: T.accent, lineHeight: 1 }}>◇</div>
        <Kicker color={T.accent}>automation</Kicker>
        <h2
          style={{
            fontFamily: T.fontHead,
            fontSize: clampPx(30, 7, 44),
            fontWeight: 500,
            margin: "14px 0 16px",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          No bots{" "}
          <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>yet</span>.
        </h2>
        <p
          style={{
            fontSize: 14,
            color: T.text2,
            lineHeight: 1.7,
            maxWidth: 520,
            margin: "0 auto 22px",
          }}
        >
          A bot is a paper-trading runner bound to one of your strategies. It watches the market,
          fires the strategy&apos;s signals, and simulates a portfolio. No real broker — no real
          money.
        </p>
        <div style={{ display: "inline-flex", gap: 10 }}>
          <Link href="/bots/new" style={{ textDecoration: "none" }}>
            <Btn variant="primary" size="lg" icon={Icon.plus}>
              Create a bot
            </Btn>
          </Link>
        </div>
        <div
          style={{
            marginTop: 32,
            padding: 20,
            background: T.surfaceLow,
            borderRadius: 8,
            textAlign: "left",
            border: `1px solid ${T.outlineFaint}`,
          }}
        >
          <Kicker>the flow</Kicker>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontFamily: T.fontMono,
              fontSize: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: T.primaryLight }}>Strategies</span>
            <span style={{ color: T.text3 }}>→</span>
            <span style={{ color: T.text2 }}>Pick one</span>
            <span style={{ color: T.text3 }}>→</span>
            <span style={{ color: T.accent }}>Spin up bot</span>
            <span style={{ color: T.text3 }}>→</span>
            <span style={{ color: T.gain }}>Running</span>
          </div>
        </div>
      </div>
    </div>
  );
}
