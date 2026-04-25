"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import {
  Btn,
  Connector,
  GateGlyph,
  Kicker,
  Pin,
  Ribbon,
  StatusDot,
} from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick, clampPx } from "@/components/responsive";

type SelKind = "condition" | "execution" | "group";
type Selection = { kind: SelKind; id: string } | null;

type CondMeta = {
  indicator: string;
  op: string;
  val: string;
  valIsRef?: boolean;
  meta: string;
  kind: "momentum" | "trend" | "volume";
  compact?: boolean;
};

const CONDITIONS: Record<string, CondMeta> = {
  rsi: { indicator: "RSI (14)", op: "< ", val: "30", meta: "oversold", kind: "momentum" },
  close: {
    indicator: "Close",
    op: "> ",
    val: "SMA (200)",
    valIsRef: true,
    meta: "trend filter",
    kind: "trend",
  },
  vol: {
    indicator: "Volume",
    op: "> ",
    val: "avg × 1.5",
    meta: "confirmation · OR leg 1",
    kind: "volume",
    compact: true,
  },
  macd: {
    indicator: "MACD",
    op: "×↑",
    val: "Signal",
    valIsRef: true,
    meta: "confirmation · OR leg 2",
    kind: "momentum",
    compact: true,
  },
};

type DrawerAction = "save" | "duplicate" | "delete" | "dissolve";

export default function EditorPage() {
  const [selection, setSelection] = useState<Selection>(null);
  const [deployed, setDeployed] = useState(true);
  const [savedAt, setSavedAt] = useState<number>(() => Date.now() - 2 * 60_000);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  const onSelect = (kind: SelKind, id: string) =>
    setSelection((prev) =>
      prev?.kind === kind && prev.id === id ? null : { kind, id }
    );
  const close = () => setSelection(null);

  const handleSaveDraft = () => {
    setSavedAt(Date.now());
    setFlash("Draft saved");
  };

  const handleValidate = () => {
    setFlash("Strategy is valid · 4 conditions connected");
  };

  const handleDeploy = () => {
    setDeployed((d) => {
      const next = !d;
      setFlash(next ? "Strategy deployed · live signal feed active" : "Strategy paused · signals halted");
      return next;
    });
  };

  const handleRestoreVersion = (label: string) => {
    setSavedAt(Date.now());
    setFlash(`Restored ${label}`);
  };

  const handleDrawerAction = (action: DrawerAction, subjectLabel: string) => {
    close();
    const verb: Record<DrawerAction, string> = {
      save: "Saved",
      duplicate: "Duplicated",
      delete: "Deleted",
      dissolve: "Dissolved",
    };
    setFlash(`${verb[action]} · ${subjectLabel}`);
  };

  const handleAdd = (what: "condition" | "group") => {
    setFlash(
      what === "condition"
        ? "Pick a condition from the palette — coming soon"
        : "New group added to canvas — coming soon"
    );
  };

  return (
    <AppFrame route="/strategies">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header
          deployed={deployed}
          savedAt={savedAt}
          onSaveDraft={handleSaveDraft}
          onRestoreVersion={handleRestoreVersion}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            overflow: "hidden",
            position: "relative",
            minHeight: 0,
          }}
        >
          <Canvas
            selection={selection}
            onSelect={onSelect}
            drawerOpen={selection !== null}
            deployed={deployed}
            onValidate={handleValidate}
            onDeploy={handleDeploy}
            onAdd={handleAdd}
          />
          {selection?.kind === "condition" && (
            <ConditionDrawer
              key={selection.id}
              node={CONDITIONS[selection.id]}
              onClose={close}
              onAction={handleDrawerAction}
            />
          )}
          {selection?.kind === "execution" && (
            <ExecutionDrawer onClose={close} onAction={handleDrawerAction} />
          )}
          {selection?.kind === "group" && (
            <GroupDrawer onClose={close} onAction={handleDrawerAction} />
          )}
        </div>
      </div>
      {flash && <FlashToast message={flash} />}
    </AppFrame>
  );
}

function FlashToast({ message }: { message: string }) {
  const T = useT();
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: T.surface2,
        color: T.text,
        padding: "10px 18px",
        borderRadius: 999,
        boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 12px 40px -12px rgba(0,0,0,0.5)`,
        fontFamily: T.fontMono,
        fontSize: 12,
        zIndex: 1000,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ color: T.gain }}>✓</span>
      {message}
    </div>
  );
}

function formatSavedLabel(savedAt: number): string {
  const ms = Date.now() - savedAt;
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "saved just now";
  if (mins === 1) return "saved 1m ago";
  if (mins < 60) return `saved ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "saved 1h ago" : `saved ${hrs}h ago`;
}

interface VersionEntry {
  id: string;
  label: string;
  when: string;
  note: string;
  current?: boolean;
}

const MOCK_VERSIONS: VersionEntry[] = [
  { id: "v4", label: "v4", when: "just now", note: "current draft", current: true },
  { id: "v3", label: "v3", when: "2d ago", note: "tightened RSI to < 30" },
  { id: "v2", label: "v2", when: "5d ago", note: "added volume confirmation" },
  { id: "v1", label: "v1", when: "12d ago", note: "initial preset from RSI Bounce" },
];

function Header({
  deployed,
  savedAt,
  onSaveDraft,
  onRestoreVersion,
}: {
  deployed: boolean;
  savedAt: number;
  onSaveDraft: () => void;
  onRestoreVersion: (label: string) => void;
}) {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!historyOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHistoryOpen(false);
    }
    function onDoc(e: MouseEvent) {
      if (!historyAnchorRef.current) return;
      if (!historyAnchorRef.current.contains(e.target as Node)) setHistoryOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [historyOpen]);

  const savedLabel = formatSavedLabel(savedAt);
  const statusColor = deployed ? T.deploy : T.warning;
  const statusLabel = deployed ? "deployed" : "draft";

  return (
    <div
      style={{
        padding: pick(bp, {
          mobile: `14px ${padX} 12px`,
          desktop: `20px ${padX} 16px`,
        }),
        borderBottom: `1px solid ${T.outlineFaint}`,
        display: "flex",
        alignItems: isMobile ? "stretch" : "flex-end",
        gap: isMobile ? 12 : 24,
        flexDirection: isMobile ? "column" : "row",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.text3,
            letterSpacing: 0.5,
            flexWrap: "wrap",
          }}
        >
          <Link href="/strategies" style={{ color: T.primaryLight }}>
            Strategies
          </Link>
          <span style={{ color: T.text3 }}>/</span>
          <span style={{ color: T.text2 }}>rsi_bounce_v1</span>
          <StatusDot color={statusColor} pulse={deployed} />
          <span style={{ color: statusColor, textTransform: "uppercase", letterSpacing: 0.6 }}>
            {statusLabel}
          </span>
          <span style={{ color: T.text3 }}>· {savedLabel} · 3 signals today</span>
        </div>
        <h1
          style={{
            fontFamily: T.fontHead,
            fontSize: clampPx(22, 5, 34),
            fontWeight: 500,
            margin: "10px 0 0",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          RSI Bounce{" "}
          <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>v1</span>
          <span
            style={{
              color: T.text3,
              fontFamily: T.fontMono,
              fontSize: 13,
              fontWeight: 400,
              marginLeft: 14,
              display: isMobile ? "block" : "inline",
            }}
          >
            · mean reversion · KSE-100
          </span>
        </h1>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3, marginRight: 4 }}>
          last backtest <span style={{ color: T.gain }}>+14.2%</span>
        </span>
        <div ref={historyAnchorRef} style={{ position: "relative" }}>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            History
          </Btn>
          {historyOpen && (
            <HistoryPopover
              onRestore={(label) => {
                setHistoryOpen(false);
                onRestoreVersion(label);
              }}
            />
          )}
        </div>
        <Btn variant="outline" size="sm" onClick={onSaveDraft}>
          Save draft
        </Btn>
      </div>
    </div>
  );
}

function HistoryPopover({ onRestore }: { onRestore: (label: string) => void }) {
  const T = useT();
  return (
    <div
      aria-label="Version history"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        minWidth: 260,
        background: T.surface2,
        borderRadius: 10,
        boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 20px 60px -12px rgba(0,0,0,0.5)`,
        zIndex: 50,
        padding: 6,
      }}
    >
      <div
        style={{
          padding: "8px 10px 6px",
          fontFamily: T.fontMono,
          fontSize: 10.5,
          color: T.text3,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        Version history
      </div>
      {MOCK_VERSIONS.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => !v.current && onRestore(`${v.label} · ${v.when}`)}
          disabled={v.current}
          style={{
            display: "flex",
            width: "100%",
            alignItems: "baseline",
            gap: 10,
            padding: "8px 10px",
            border: "none",
            borderRadius: 6,
            background: "transparent",
            textAlign: "left",
            cursor: v.current ? "default" : "pointer",
            color: T.text,
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => {
            if (!v.current) (e.currentTarget as HTMLButtonElement).style.background = T.surfaceLow;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <span
            style={{
              fontFamily: T.fontMono,
              fontSize: 12,
              color: v.current ? T.primaryLight : T.text,
              minWidth: 28,
            }}
          >
            {v.label}
          </span>
          <span style={{ flex: 1, fontSize: 12, color: T.text2 }}>{v.note}</span>
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3 }}>
            {v.current ? "current" : v.when}
          </span>
        </button>
      ))}
    </div>
  );
}

function Canvas({
  selection,
  onSelect,
  drawerOpen,
  deployed,
  onValidate,
  onDeploy,
  onAdd,
}: {
  selection: Selection;
  onSelect: (kind: SelKind, id: string) => void;
  drawerOpen: boolean;
  deployed: boolean;
  onValidate: () => void;
  onDeploy: () => void;
  onAdd: (what: "condition" | "group") => void;
}) {
  const isSelected = (kind: SelKind, id: string) =>
    selection?.kind === kind && selection.id === id;
  const T = useT();
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStartRef = useRef<{
    dist: number;
    zoom: number;
    midScreen: { x: number; y: number };
    midWorld: { x: number; y: number };
  } | null>(null);
  const viewRef = useRef({ pan, zoom });

  useEffect(() => {
    viewRef.current = { pan, zoom };
  }, [pan, zoom]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const { pan: cp, zoom: cz } = viewRef.current;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nz = Math.max(0.3, Math.min(2.5, cz * factor));
      const wx = (cx - cp.x) / cz;
      const wy = (cy - cp.y) / cz;
      setPan({ x: cx - wx * nz, y: cy - wy * nz });
      setZoom(nz);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const tgt = e.target as HTMLElement;
    const isBg =
      tgt === canvasRef.current ||
      tgt === worldRef.current ||
      tgt.dataset?.bg === "true";
    if (!isBg) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { pan: cp, zoom: cz } = viewRef.current;
    if (pointersRef.current.size === 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: cp.x, panY: cp.y };
      pinchStartRef.current = null;
      setIsDragging(true);
    } else if (pointersRef.current.size === 2) {
      const el = canvasRef.current;
      if (!el) return;
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const rect = el.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      pinchStartRef.current = {
        dist,
        zoom: cz,
        midScreen: { x: mx, y: my },
        midWorld: { x: (mx - cp.x) / cz, y: (my - cp.y) / cz },
      };
      panStartRef.current = null;
    }
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2 && pinchStartRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const start = pinchStartRef.current;
      if (start.dist <= 0) return;
      const scale = dist / start.dist;
      const nz = Math.max(0.3, Math.min(2.5, start.zoom * scale));
      setPan({
        x: start.midScreen.x - start.midWorld.x * nz,
        y: start.midScreen.y - start.midWorld.y * nz,
      });
      setZoom(nz);
    } else if (panStartRef.current && pointersRef.current.size === 1) {
      const start = panStartRef.current;
      setPan({
        x: start.panX + (e.clientX - start.x),
        y: start.panY + (e.clientY - start.y),
      });
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.delete(e.pointerId);
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    if (pointersRef.current.size === 1) {
      const [remaining] = Array.from(pointersRef.current.values());
      const { pan: cp } = viewRef.current;
      panStartRef.current = {
        x: remaining.x,
        y: remaining.y,
        panX: cp.x,
        panY: cp.y,
      };
      pinchStartRef.current = null;
    } else if (pointersRef.current.size === 0) {
      panStartRef.current = null;
      pinchStartRef.current = null;
      setIsDragging(false);
    }
  };

  const bumpZoom = (factor: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const nz = Math.max(0.3, Math.min(2.5, zoom * factor));
    const wx = (cx - pan.x) / zoom;
    const wy = (cy - pan.y) / zoom;
    setPan({ x: cx - wx * nz, y: cy - wy * nz });
    setZoom(nz);
  };

  const resetView = () => {
    setPan({ x: 40, y: 20 });
    setZoom(1);
  };

  return (
    <div
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        backgroundColor: T.surfaceLowest,
        backgroundImage: `radial-gradient(circle, ${T.surface3}80 0.8px, transparent 0.8px)`,
        backgroundSize: `${36 * zoom}px ${36 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      <div
        ref={worldRef}
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "0 0",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <Connector d="M 240 134 C 320 134 320 290 385 290" dashed T={T} />
          <Connector d="M 240 254 C 320 254 320 305 385 305" dashed T={T} />
          <Connector d="M 240 444 C 275 444 275 475 300 475" dashed T={T} />
          <Connector d="M 240 564 C 275 564 275 495 300 495" dashed T={T} />
          <Connector d="M 370 485 C 378 485 378 320 385 320" dashed T={T} />
          <Connector d="M 545 305 C 585 305 585 304 620 304" color={T.primaryLight} width={2} T={T} />
          <Connector d="M 860 304 C 870 304 870 104 880 104" color={T.primary} width={1.3} T={T} />
          <Connector d="M 860 304 C 870 304 870 292 880 292" color={T.deploy} width={1.6} T={T} />
          <Connector d="M 860 304 C 870 304 870 464 880 464" color={T.accent} width={1.3} T={T} />
        </svg>

        <GroupBox
          x={24}
          y={380}
          w={240}
          h={240}
          label="OR group"
          selected={isSelected("group", "or")}
          onClick={() => onSelect("group", "or")}
        />

        <CondNode
          x={40}
          y={80}
          {...CONDITIONS.rsi}
          selected={isSelected("condition", "rsi")}
          onClick={() => onSelect("condition", "rsi")}
        />
        <CondNode
          x={40}
          y={200}
          {...CONDITIONS.close}
          selected={isSelected("condition", "close")}
          onClick={() => onSelect("condition", "close")}
        />
        <CondNode
          x={40}
          y={400}
          {...CONDITIONS.vol}
          selected={isSelected("condition", "vol")}
          onClick={() => onSelect("condition", "vol")}
        />
        <CondNode
          x={40}
          y={520}
          {...CONDITIONS.macd}
          selected={isSelected("condition", "macd")}
          onClick={() => onSelect("condition", "macd")}
        />

        <div
          data-bg="true"
          style={{
            position: "absolute",
            left: 410,
            top: 250,
            width: 110,
            height: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <GateGlyph logic="AND" size={68} />
        </div>
        <div
          data-bg="true"
          style={{
            position: "absolute",
            left: 300,
            top: 450,
            width: 70,
            height: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <GateGlyph logic="OR" size={42} />
        </div>

        <ExecNode
          x={620}
          y={250}
          selected={isSelected("execution", "exec")}
          onClick={() => onSelect("execution", "exec")}
        />

        <OutputPin x={880} y={80} tint={T.primary} glyph="⎈" title="Backtest" status="+14.2%" statusColor={T.gain} sub="last run 2m ago" href="/backtest" />
        <OutputPin
          x={880}
          y={268}
          tint={deployed ? T.deploy : T.text3}
          glyph="◉"
          title="Live signals"
          status={deployed ? "Deployed" : "Paused"}
          statusColor={deployed ? T.deploy : T.text3}
          sub={deployed ? "3 today · 100 scanned" : "feed halted"}
          emphasized={deployed}
          href="/signals"
        />
        <OutputPin x={880} y={440} tint={T.accent} glyph="◇" title="Automate" status="No bot" statusColor={T.text3} sub="bind for paper trading" href="/bots/new" />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 76,
          left: 24,
          display: "flex",
          gap: 6,
          zIndex: 5,
        }}
      >
        <AddPill onClick={() => onAdd("condition")}>condition</AddPill>
        <AddPill onClick={() => onAdd("group")}>group</AddPill>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: drawerOpen ? 412 : 24,
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "4px 6px",
          borderRadius: 999,
          background: T.surface2 + "e6",
          backdropFilter: "blur(10px)",
          border: `1px solid ${T.outlineFaint}`,
          fontFamily: T.fontMono,
          fontSize: 11,
          color: T.text3,
          zIndex: 5,
          userSelect: "none",
          transition: "right 240ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <ZoomBtn onClick={() => bumpZoom(1 / 1.2)} label="−" />
        <span
          style={{
            color: T.text2,
            padding: "0 8px",
            minWidth: 40,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <ZoomBtn onClick={() => bumpZoom(1.2)} label="+" />
        <span style={{ width: 1, height: 14, background: T.outlineFaint, margin: "0 4px" }} />
        <ZoomBtn onClick={resetView} label="fit" />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          padding: 6,
          background: T.surface2 + "e6",
          backdropFilter: "blur(10px)",
          borderRadius: 999,
          boxShadow: `0 10px 40px -10px rgba(0,0,0,0.6), 0 0 0 1px ${T.outlineFaint}`,
          alignItems: "center",
          zIndex: 5,
        }}
      >
        <Btn variant="ghost" size="sm" onClick={onValidate}>
          Validate
        </Btn>
        <div style={{ width: 1, height: 20, background: T.outlineFaint }} />
        <Link href="/backtest" style={{ textDecoration: "none" }}>
          <Btn variant="outline" size="sm">
            Run backtest
          </Btn>
        </Link>
        <Btn variant="deploy" size="sm" icon={Icon.spark} onClick={onDeploy}>
          {deployed ? "Pause" : "Deploy"}
        </Btn>
        <Link href="/bots/new" style={{ textDecoration: "none" }}>
          <Btn variant="primary" size="sm" icon={Icon.bot}>
            + Bot
          </Btn>
        </Link>
      </div>
    </div>
  );
}

function ZoomBtn({ onClick, label }: { onClick: () => void; label: string }) {
  const T = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        color: T.text2,
        cursor: "pointer",
        minWidth: 28,
        minHeight: 28,
        padding: "6px 10px",
        borderRadius: 999,
        fontFamily: "inherit",
        fontSize: "inherit",
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}

function CondNode({
  x,
  y,
  indicator,
  op,
  val,
  valIsRef,
  meta,
  kind,
  compact,
  selected,
  onClick,
}: {
  x: number;
  y: number;
  indicator: string;
  op: string;
  val: string;
  valIsRef?: boolean;
  meta: string;
  kind: "momentum" | "trend" | "volume";
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const T = useT();
  const h = compact ? 88 : 108;
  const kindColor: Record<string, string> = {
    momentum: T.primaryLight,
    trend: T.accent,
    volume: "#c7a885",
  };
  const color = kindColor[kind] || T.primaryLight;
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 200,
        height: h,
        background: T.surfaceLow,
        borderRadius: 10,
        padding: "12px 14px",
        cursor: onClick ? "pointer" : undefined,
        boxShadow: selected
          ? `0 0 0 2px ${T.primary}, 0 8px 28px -10px rgba(0,0,0,0.6)`
          : `0 0 0 1px ${T.outlineFaint}, 0 4px 12px -8px rgba(0,0,0,0.5)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: T.fontMono,
          fontSize: 10,
          color,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: 2, background: color }} />
        {meta}
      </div>
      <div
        style={{
          fontFamily: T.fontHead,
          fontSize: 15,
          fontWeight: 500,
          color: T.text,
          marginTop: 6,
          letterSpacing: -0.2,
        }}
      >
        {indicator}
      </div>
      <div
        style={{
          fontFamily: T.fontMono,
          fontSize: 12,
          color: T.text2,
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ color: T.text3 }}>{op}</span>
        <span style={{ color: valIsRef ? T.primaryLight : T.accent }}>{val}</span>
      </div>
      <Pin x={196} y={h / 2 - 4} color={T.primary} />
    </div>
  );
}

function ExecNode({ x, y, selected, onClick }: { x: number; y: number; selected?: boolean; onClick?: () => void }) {
  const T = useT();
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 240,
        height: 108,
        background: T.surfaceLow,
        borderRadius: 12,
        padding: "14px 16px",
        cursor: onClick ? "pointer" : undefined,
        boxShadow: selected
          ? `0 0 0 2px ${T.accent}, 0 10px 30px -10px rgba(0,0,0,0.6)`
          : `0 0 0 1px ${T.outlineFaint}, 0 4px 14px -8px rgba(0,0,0,0.5)`,
        borderLeft: `3px solid ${T.accent}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: T.fontMono,
          fontSize: 10,
          color: T.accent,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: 2, background: T.accent }} />
        execution
      </div>
      <div
        style={{
          fontFamily: T.fontHead,
          fontSize: 16,
          fontWeight: 500,
          color: T.text,
          marginTop: 6,
          letterSpacing: -0.2,
        }}
      >
        Buy · <span style={{ fontStyle: "italic", color: T.accent }}>10%</span> of book
      </div>
      <div
        style={{
          fontFamily: T.fontMono,
          fontSize: 11,
          color: T.text3,
          marginTop: 6,
          display: "flex",
          gap: 10,
        }}
      >
        <span>
          SL <span style={{ color: T.loss }}>5%</span>
        </span>
        <span>
          TP <span style={{ color: T.gain }}>15%</span>
        </span>
        <span>
          hold <span style={{ color: T.text2 }}>21d</span>
        </span>
      </div>
      <Pin x={-4} y={50} color={T.primaryLight} />
      <Pin x={236} y={50} color={T.accent} />
    </div>
  );
}

function OutputPin({
  x,
  y,
  tint,
  glyph,
  title,
  status,
  statusColor,
  sub,
  emphasized,
  href,
}: {
  x: number;
  y: number;
  tint: string;
  glyph: string;
  title: string;
  status: string;
  statusColor: string;
  sub: string;
  emphasized?: boolean;
  href?: string;
}) {
  const T = useT();
  const body = (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 180,
        padding: "12px 14px",
        background: T.surfaceLow,
        borderRadius: 10,
        textDecoration: "none",
        boxShadow: emphasized
          ? `0 0 0 1px ${tint}88, 0 0 0 4px ${tint}18, 0 6px 24px -10px rgba(0,0,0,0.55)`
          : `0 0 0 1px ${T.outlineFaint}, 0 4px 14px -8px rgba(0,0,0,0.5)`,
      }}
    >
      <Pin x={-4} y={20} color={tint} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: tint + "22",
            color: tint,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: T.fontHead,
            fontSize: 13,
          }}
        >
          {glyph}
        </span>
        <span style={{ fontFamily: T.fontHead, fontSize: 14, fontWeight: 500, color: T.text }}>
          {title}
        </span>
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: T.fontMono,
          fontSize: 12,
        }}
      >
        {emphasized && <StatusDot color={statusColor} pulse />}
        <span style={{ color: statusColor, fontVariantNumeric: "tabular-nums" }}>{status}</span>
      </div>
      <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3, marginTop: 3 }}>
        {sub}
      </div>
    </div>
  );
  return href ? (
    <Link href={href as "/backtest"} style={{ textDecoration: "none" }}>
      {body}
    </Link>
  ) : (
    body
  );
}

function GroupBox({
  x,
  y,
  w,
  h,
  label,
  selected,
  onClick,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const T = useT();
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        border: `1px dashed ${selected ? T.primaryLight : T.outlineVariant}`,
        borderRadius: 12,
        background: `linear-gradient(180deg, ${T.primary}${selected ? "14" : "08"}, transparent)`,
        cursor: onClick ? "pointer" : undefined,
        boxShadow: selected ? `0 0 0 1px ${T.primaryLight}66` : undefined,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -10,
          left: 14,
          padding: "2px 10px",
          fontFamily: T.fontHead,
          fontStyle: "italic",
          fontWeight: 600,
          fontSize: 11,
          color: T.primaryLight,
          background: T.surfaceLowest,
          borderRadius: 999,
          letterSpacing: 0.3,
          pointerEvents: "none",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function AddPill({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const T = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 11.5,
        color: T.text3,
        background: T.surface2 + "cc",
        border: `1px dashed ${T.outlineVariant}`,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: T.fontMono,
        backdropFilter: "blur(6px)",
        cursor: onClick ? "pointer" : "default",
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        (e.currentTarget as HTMLButtonElement).style.color = T.text2;
        (e.currentTarget as HTMLButtonElement).style.borderStyle = "solid";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = T.text3;
        (e.currentTarget as HTMLButtonElement).style.borderStyle = "dashed";
      }}
    >
      + {children}
    </button>
  );
}

type CompareMode = "Constant" | "Indicator" | "Price ref";

function useSliderDrag(onChange: (pct: number) => void) {
  const trackRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const update = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChangeRef.current(pct);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    update(e.clientX);
    e.preventDefault();
    e.stopPropagation();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (!el.hasPointerCapture(e.pointerId)) return;
    update(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  };

  return { trackRef, onPointerDown, onPointerMove, onPointerUp };
}

const OPERATORS = [">", "≥", "<", "≤", "=", "×↑", "×↓", "·"] as const;
const COMPARE_MODES: CompareMode[] = ["Constant", "Indicator", "Price ref"];

function DrawerContainer({ children }: { children: React.ReactNode }) {
  const T = useT();
  const { isMobile } = useBreakpoint();
  return (
    <div
      style={{
        position: "absolute",
        top: isMobile ? 0 : 16,
        right: isMobile ? 0 : 16,
        bottom: isMobile ? 0 : 16,
        left: isMobile ? 0 : "auto",
        width: isMobile ? "100%" : 380,
        maxWidth: "100%",
        background: T.surface2,
        borderRadius: isMobile ? 0 : 12,
        boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 20px 60px -20px rgba(0,0,0,0.7)`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 30,
      }}
    >
      {children}
    </div>
  );
}

function ConditionDrawer({
  node,
  onClose,
  onAction,
}: {
  node?: CondMeta;
  onClose: () => void;
  onAction: (action: DrawerAction, subjectLabel: string) => void;
}) {
  const T = useT();
  const title = node?.indicator ?? "Condition";
  const kindLabel =
    node?.kind === "momentum"
      ? "Momentum indicator"
      : node?.kind === "trend"
      ? "Trend filter"
      : node?.kind === "volume"
      ? "Volume confirmation"
      : "Condition";

  const initialOp = (node?.op ?? "<").trim() || "<";
  const initialCompare: CompareMode = node?.valIsRef ? "Indicator" : "Constant";

  const [op, setOp] = useState<string>(initialOp);
  const [compareMode, setCompareMode] = useState<CompareMode>(initialCompare);
  const [period, setPeriod] = useState("14");
  const [timeframe, setTimeframe] = useState("1D");
  const [threshold, setThreshold] = useState(30);
  const thresholdPct = Math.max(0, Math.min(100, threshold));

  const slider = useSliderDrag((pct) => setThreshold(Math.round(pct * 100)));

  return (
    <DrawerContainer>
      <div style={{ padding: "18px 22px 0", position: "relative" }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drawer"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 28,
            height: 28,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: 6,
            color: T.text3,
            cursor: "pointer",
          }}
        >
          {Icon.close}
        </button>
        <Kicker color={T.primaryLight}>{node?.meta ?? "condition"}</Kicker>
        <h2
          style={{
            fontFamily: T.fontHead,
            fontSize: 22,
            fontWeight: 500,
            margin: "10px 0 4px",
            letterSpacing: -0.4,
          }}
        >
          {title}
        </h2>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
          {kindLabel} · {op} {compareMode === "Constant" ? threshold : node?.val}
        </div>
      </div>

      <div style={{ flex: 1, overflowX: "hidden", overflowY: "auto", padding: 22, paddingTop: 16 }}>
        <Ribbon kicker="definition" />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12, marginTop: 6 }}>
          <Field label="Period" value={period} onChange={setPeriod} suffix="bars" />
          <Field label="Timeframe" value={timeframe} onChange={setTimeframe} />
        </div>

        <div style={{ marginTop: 18 }}>
          <Kicker>operator</Kicker>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 6,
              marginTop: 8,
            }}
          >
            {OPERATORS.map((o) => {
              const active = op === o;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOp(o)}
                  style={{
                    padding: "8px 0",
                    textAlign: "center",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: T.fontMono,
                    fontSize: 13,
                    background: active ? T.primary + "22" : T.surface,
                    color: active ? T.primaryLight : T.text2,
                    boxShadow: active
                      ? `0 0 0 1.5px ${T.primary}`
                      : `0 0 0 1px ${T.outlineFaint}`,
                    transition: "background 140ms, color 140ms, box-shadow 140ms",
                  }}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <Kicker>compared to</Kicker>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {COMPARE_MODES.map((t) => {
              const active = compareMode === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCompareMode(t)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 11.5,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: active ? T.surface3 : T.surface,
                    color: active ? T.text : T.text3,
                    boxShadow: `0 0 0 1px ${active ? T.outlineVariant : T.outlineFaint}`,
                    transition: "background 140ms, color 140ms",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 10,
              padding: "12px 14px",
              background: T.surface,
              borderRadius: 8,
              boxShadow: `0 0 0 1px ${T.outlineFaint}`,
              display: "flex",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={threshold}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                if (digits === "") {
                  setThreshold(0);
                  return;
                }
                const n = Number(digits);
                if (Number.isFinite(n)) setThreshold(Math.max(0, Math.min(100, n)));
              }}
              style={{
                fontFamily: T.fontHead,
                fontSize: 28,
                color: T.text,
                letterSpacing: -0.4,
                fontVariantNumeric: "tabular-nums",
                background: "transparent",
                border: "none",
                width: 64,
                padding: 0,
              }}
            />
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>of 100</span>
            <div style={{ flex: 1 }} />
            <div
              ref={slider.trackRef}
              onPointerDown={slider.onPointerDown}
              onPointerMove={slider.onPointerMove}
              onPointerUp={slider.onPointerUp}
              onPointerCancel={slider.onPointerUp}
              style={{
                position: "relative",
                width: 120,
                height: 14,
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                touchAction: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: 4,
                  borderRadius: 2,
                  background: T.surface3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${thresholdPct}%`,
                    background: T.primaryLight,
                    transition: "width 80ms linear",
                  }}
                />
              </div>
              <div
                style={{
                  position: "absolute",
                  left: `${thresholdPct}%`,
                  top: "50%",
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  background: T.primaryLight,
                  transform: "translate(-6px, -6px)",
                  boxShadow: `0 0 0 3px ${T.primaryLight}33`,
                }}
              />
            </div>
          </div>
        </div>

        <Ribbon kicker="behavior" color={T.primaryLight} />
        <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.6, marginTop: 4 }}>
          Fires when momentum dips into{" "}
          <span style={{ color: T.primaryLight }}>oversold</span> territory. Typical read:
          &ldquo;reversion likely&rdquo; — pairs well with a trend filter to avoid falling knives.
        </div>

        <Ribbon kicker="historical fit" />
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
          <span
            style={{
              fontFamily: T.fontHead,
              fontSize: 34,
              color: T.primaryLight,
              letterSpacing: -0.6,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            47
          </span>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
            fires / 252 days · 86 symbols · 18.6% hit rate
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 42, marginTop: 12 }}>
          {[2, 4, 3, 5, 2, 6, 3, 4, 5, 3, 7, 2, 4, 3, 5, 2, 4, 3, 6, 4, 2, 3, 5, 4, 6, 3].map((b, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: (b / 7) * 42,
                background: T.primaryLight + "80",
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          padding: 14,
          borderTop: `1px solid ${T.outlineFaint}`,
          display: "flex",
          gap: 8,
        }}
      >
        <Btn variant="danger" size="sm" onClick={() => onAction("delete", title)}>
          Delete
        </Btn>
        <div style={{ flex: 1 }} />
        <Btn variant="outline" size="sm" onClick={() => onAction("duplicate", title)}>
          Duplicate
        </Btn>
        <Btn variant="primary" size="sm" onClick={() => onAction("save", title)}>
          Save
        </Btn>
      </div>
    </DrawerContainer>
  );
}

function Field({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: string;
  suffix?: string;
  onChange?: (v: string) => void;
}) {
  const T = useT();
  return (
    <div>
      <Kicker>{label}</Kicker>
      <div
        style={{
          marginTop: 6,
          padding: "10px 12px",
          background: T.surface,
          borderRadius: 8,
          boxShadow: `0 0 0 1px ${T.outlineFaint}`,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {onChange ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              fontFamily: T.fontMono,
              fontSize: 13,
              color: T.text,
              background: "transparent",
              border: "none",
              padding: 0,
              flex: 1,
              minWidth: 0,
            }}
          />
        ) : (
          <span style={{ fontFamily: T.fontMono, fontSize: 13, color: T.text }}>{value}</span>
        )}
        {suffix && (
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3 }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

type Direction = "Long" | "Short" | "Either";
type ExitKey = "stopLoss" | "takeProfit" | "trailingStop" | "maxHolding" | "exitSignal";

const DIRECTIONS: Direction[] = ["Long", "Short", "Either"];

function ExecutionDrawer({
  onClose,
  onAction,
}: {
  onClose: () => void;
  onAction: (action: DrawerAction, subjectLabel: string) => void;
}) {
  const T = useT();
  const [direction, setDirection] = useState<Direction>("Long");
  const [sizing, setSizing] = useState(10);
  const [exits, setExits] = useState<Record<ExitKey, { on: boolean; value: string }>>({
    stopLoss: { on: true, value: "5%" },
    takeProfit: { on: true, value: "15%" },
    trailingStop: { on: false, value: "—" },
    maxHolding: { on: true, value: "21 days" },
    exitSignal: { on: false, value: "separate tree" },
  });

  const slider = useSliderDrag((pct) => setSizing(Math.round(pct * 100)));

  const toggleExit = (k: ExitKey) =>
    setExits((prev) => ({ ...prev, [k]: { ...prev[k], on: !prev[k].on } }));
  const setExitValue = (k: ExitKey, v: string) =>
    setExits((prev) => ({ ...prev, [k]: { ...prev[k], value: v } }));

  const reset = () => {
    setDirection("Long");
    setSizing(10);
    setExits({
      stopLoss: { on: true, value: "5%" },
      takeProfit: { on: true, value: "15%" },
      trailingStop: { on: false, value: "—" },
      maxHolding: { on: true, value: "21 days" },
      exitSignal: { on: false, value: "separate tree" },
    });
  };

  return (
    <DrawerContainer>
      <div style={{ padding: "18px 22px 0", position: "relative" }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drawer"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 28,
            height: 28,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: 6,
            color: T.text3,
            cursor: "pointer",
          }}
        >
          {Icon.close}
        </button>
        <Kicker color={T.accent}>execution node</Kicker>
        <h2
          style={{
            fontFamily: T.fontHead,
            fontSize: 22,
            fontWeight: 500,
            margin: "10px 0 4px",
            letterSpacing: -0.4,
          }}
        >
          Position <span style={{ fontStyle: "italic", color: T.accent }}>sizing</span> &amp; exits
        </h2>
      </div>
      <div style={{ flex: 1, overflowX: "hidden", overflowY: "auto", padding: 22, paddingTop: 14 }}>
        <Ribbon kicker="direction" />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {DIRECTIONS.map((o) => {
            const active = direction === o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => setDirection(o)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: T.fontSans,
                  background: active ? T.accent + "22" : T.surface,
                  color: active ? T.accent : T.text3,
                  boxShadow: `0 0 0 1px ${active ? T.accent : T.outlineFaint}`,
                  transition: "background 140ms, color 140ms",
                }}
              >
                {o}
              </button>
            );
          })}
        </div>

        <Ribbon kicker="sizing" />
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "baseline" }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={sizing}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                if (digits === "") {
                  setSizing(0);
                  return;
                }
                const n = Number(digits);
                if (Number.isFinite(n)) setSizing(Math.max(0, Math.min(100, n)));
              }}
              style={{
                fontFamily: T.fontHead,
                fontSize: 54,
                color: T.text,
                letterSpacing: -1,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
                background: "transparent",
                border: "none",
                padding: 0,
                width: 90,
              }}
            />
            <span
              style={{
                fontFamily: T.fontHead,
                fontSize: 54,
                color: T.text,
                letterSpacing: -1,
                lineHeight: 1,
              }}
            >
              %
            </span>
          </div>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
            of portfolio per trade
          </span>
        </div>
        <div
          ref={slider.trackRef}
          onPointerDown={slider.onPointerDown}
          onPointerMove={slider.onPointerMove}
          onPointerUp={slider.onPointerUp}
          onPointerCancel={slider.onPointerUp}
          style={{
            marginTop: 14,
            position: "relative",
            height: 18,
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            touchAction: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 6,
              borderRadius: 3,
              background: T.surface3,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${sizing}%`,
                background: T.accent,
                borderRadius: 3,
                transition: "width 80ms linear",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: `${sizing}%`,
              top: "50%",
              width: 16,
              height: 16,
              borderRadius: 8,
              background: T.accent,
              transform: "translate(-8px, -8px)",
              boxShadow: `0 0 0 3px ${T.accent}33`,
            }}
          />
        </div>

        <Ribbon kicker="exits" />
        <ExitRow
          label="Stop loss"
          value={exits.stopLoss.value}
          color={T.loss}
          on={exits.stopLoss.on}
          onToggle={() => toggleExit("stopLoss")}
          onValueChange={(v) => setExitValue("stopLoss", v)}
        />
        <ExitRow
          label="Take profit"
          value={exits.takeProfit.value}
          color={T.gain}
          on={exits.takeProfit.on}
          onToggle={() => toggleExit("takeProfit")}
          onValueChange={(v) => setExitValue("takeProfit", v)}
        />
        <ExitRow
          label="Trailing stop"
          value={exits.trailingStop.value}
          on={exits.trailingStop.on}
          onToggle={() => toggleExit("trailingStop")}
          onValueChange={(v) => setExitValue("trailingStop", v)}
        />
        <ExitRow
          label="Max holding"
          value={exits.maxHolding.value}
          on={exits.maxHolding.on}
          onToggle={() => toggleExit("maxHolding")}
          onValueChange={(v) => setExitValue("maxHolding", v)}
        />
        <ExitRow
          label="Exit signal"
          value={exits.exitSignal.value}
          on={exits.exitSignal.on}
          onToggle={() => toggleExit("exitSignal")}
        />

        <div
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 8,
            background: T.warning + "10",
            fontSize: 11.5,
            color: T.text2,
            lineHeight: 1.55,
            display: "flex",
            gap: 8,
          }}
        >
          <span style={{ color: T.warning }}>{Icon.warn}</span>
          <span>
            With {sizing}% per trade and 5 concurrent positions, up to {Math.min(100, sizing * 5)}%
            of portfolio can be deployed.
          </span>
        </div>
      </div>
      <div
        style={{
          padding: 14,
          borderTop: `1px solid ${T.outlineFaint}`,
          display: "flex",
          gap: 8,
        }}
      >
        <div style={{ flex: 1 }} />
        <Btn variant="outline" size="sm" onClick={reset}>
          Reset
        </Btn>
        <Btn variant="primary" size="sm" onClick={() => onAction("save", "Execution")}>
          Save
        </Btn>
      </div>
    </DrawerContainer>
  );
}

function ExitRow({
  label,
  value,
  color,
  on,
  onToggle,
  onValueChange,
}: {
  label: string;
  value: string;
  color?: string;
  on: boolean;
  onToggle: () => void;
  onValueChange?: (v: string) => void;
}) {
  const T = useT();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderBottom: `1px dotted ${T.outlineFaint}`,
        opacity: on ? 1 : 0.5,
        transition: "opacity 140ms",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        aria-label={label}
        style={{
          width: 36,
          height: 24,
          borderRadius: 12,
          background: "transparent",
          position: "relative",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: "5px 5px",
            borderRadius: 7,
            background: on ? T.accent : T.surface3,
            transition: "background 140ms",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 7,
            left: on ? 18 : 7,
            width: 10,
            height: 10,
            borderRadius: 5,
            background: "#fff",
            transition: "left 140ms",
          }}
        />
      </button>
      <span style={{ fontFamily: T.fontSans, fontSize: 12.5, color: T.text, flex: 1 }}>
        {label}
      </span>
      {onValueChange && on ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          style={{
            fontFamily: T.fontMono,
            fontSize: 12.5,
            color: color || T.text2,
            fontVariantNumeric: "tabular-nums",
            background: "transparent",
            border: "none",
            padding: 0,
            width: 80,
            textAlign: "right",
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: T.fontMono,
            fontSize: 12.5,
            color: color || T.text2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

type Combinator = "OR" | "AND" | "XOR";
const COMBINATORS: Combinator[] = ["OR", "AND", "XOR"];

function GroupDrawer({
  onClose,
  onAction,
}: {
  onClose: () => void;
  onAction: (action: DrawerAction, subjectLabel: string) => void;
}) {
  const T = useT();
  const [combinator, setCombinator] = useState<Combinator>("OR");
  const legs: { indicator: string; detail: string }[] = [
    { indicator: "Volume", detail: "> avg × 1.5" },
    { indicator: "MACD", detail: "×↑ Signal" },
  ];
  return (
    <DrawerContainer>
      <div style={{ padding: "18px 22px 0", position: "relative" }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drawer"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 28,
            height: 28,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: 6,
            color: T.text3,
            cursor: "pointer",
          }}
        >
          {Icon.close}
        </button>
        <Kicker color={T.primaryLight}>logic group</Kicker>
        <h2
          style={{
            fontFamily: T.fontHead,
            fontSize: 22,
            fontWeight: 500,
            margin: "10px 0 4px",
            letterSpacing: -0.4,
          }}
        >
          {combinator}{" "}
          <span style={{ fontStyle: "italic", color: T.primaryLight }}>group</span>
        </h2>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
          {combinator === "OR"
            ? "Any leg fires · feeds the AND gate"
            : combinator === "AND"
            ? "All legs must fire · feeds the AND gate"
            : "Exactly one leg fires · feeds the AND gate"}
        </div>
      </div>

      <div style={{ flex: 1, overflowX: "hidden", overflowY: "auto", padding: 22, paddingTop: 16 }}>
        <Ribbon kicker="combinator" />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {COMBINATORS.map((t) => {
            const active = combinator === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setCombinator(t)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: T.fontSans,
                  background: active ? T.primary + "22" : T.surface,
                  color: active ? T.primaryLight : T.text3,
                  boxShadow: `0 0 0 1px ${active ? T.primary : T.outlineFaint}`,
                  transition: "background 140ms, color 140ms",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        <Ribbon kicker="legs" />
        {legs.map((leg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: `1px dotted ${T.outlineFaint}`,
            }}
          >
            <span
              style={{
                fontFamily: T.fontMono,
                fontSize: 10,
                color: T.text3,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                minWidth: 44,
              }}
            >
              leg {i + 1}
            </span>
            <span style={{ fontFamily: T.fontSans, fontSize: 13, color: T.text, flex: 1 }}>
              {leg.indicator}
            </span>
            <span
              style={{
                fontFamily: T.fontMono,
                fontSize: 12,
                color: T.text2,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {leg.detail}
            </span>
          </div>
        ))}

        <div
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 8,
            background: T.primary + "10",
            fontSize: 11.5,
            color: T.text2,
            lineHeight: 1.55,
          }}
        >
          Either leg triggers the OR group; the group itself is one of three inputs to the upstream
          AND gate. Dissolve the group to flatten both legs into the parent.
        </div>
      </div>

      <div
        style={{
          padding: 14,
          borderTop: `1px solid ${T.outlineFaint}`,
          display: "flex",
          gap: 8,
        }}
      >
        <Btn
          variant="danger"
          size="sm"
          onClick={() => onAction("dissolve", `${combinator} group`)}
        >
          Dissolve
        </Btn>
        <div style={{ flex: 1 }} />
        <Btn
          variant="outline"
          size="sm"
          onClick={() => onAction("duplicate", `${combinator} group`)}
        >
          Duplicate
        </Btn>
        <Btn
          variant="primary"
          size="sm"
          onClick={() => onAction("save", `${combinator} group`)}
        >
          Save
        </Btn>
      </div>
    </DrawerContainer>
  );
}
