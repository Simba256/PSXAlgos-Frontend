"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import { useBreakpoint, PAD, pick } from "@/components/responsive";
import { Btn, EditorialHeader } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useAlerts } from "@/lib/hooks/use-alerts";
import type { AlertResponse, AlertHistoryItem, AlertCondition, CreateAlertRequest } from "@/lib/api/alerts";
import type { StockResponse } from "@/lib/api/stocks";

/* ─── formatCondition ─── */

function formatCondition(condition: string, targetPrice: number): string {
  const labels: Record<string, string> = {
    ABOVE: `Price ≥ ${targetPrice.toFixed(2)} PKR`,
    BELOW: `Price ≤ ${targetPrice.toFixed(2)} PKR`,
    CROSSES_ABOVE: `Crosses above ${targetPrice.toFixed(2)} PKR`,
    CROSSES_BELOW: `Crosses below ${targetPrice.toFixed(2)} PKR`,
  };
  return labels[condition] ?? condition;
}

/* ─── formatRelative ─── */

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 30) return date.toLocaleDateString();
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

/* ─── AlertsView ─── */

export function AlertsView() {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);

  const [tab, setTab] = useState<"active" | "history">("active");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { alerts, history, hasLoaded, isValidating, create, toggle, remove } = useAlerts();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleToggle(alertId: number) {
    try {
      await toggle(alertId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to toggle");
    }
  }

  async function handleDelete(alertId: number) {
    try {
      await remove(alertId);
      showToast("Alert deleted");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleCreate(data: CreateAlertRequest) {
    await create(data);
    setSheetOpen(false);
    showToast(`Alert created for ${data.symbol}`);
  }

  return (
    <AppFrame route="/alerts">
      <EditorialHeader
        kicker="price alerts · your watchlist"
        title="Alerts"
        meta={
          hasLoaded ? (
            <span>{alerts.length} active alert{alerts.length !== 1 ? "s" : ""}</span>
          ) : null
        }
        actions={
          <Btn variant="primary" size="sm" icon={Icon.plus} onClick={() => setSheetOpen(true)}>
            Create Alert
          </Btn>
        }
      />

      {toast && <ToastBar message={toast} padX={padX} />}

      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <TabsHeader
          tab={tab}
          onTab={setTab}
          activeCount={alerts.length}
          historyCount={history.length}
          padX={padX}
          onCreateAlert={() => setSheetOpen(true)}
        />

        <div style={{ padding: isMobile ? `16px ${padX} 80px` : `20px ${padX} 24px`, flex: 1 }}>
          {tab === "active" ? (
            !hasLoaded ? (
              <SkeletonBlock />
            ) : alerts.length === 0 ? (
              <EmptyState
                icon={<BellIcon />}
                title="No active alerts"
                description="Create an alert to get notified when a stock hits your target price."
                action={
                  <Btn variant="primary" size="sm" icon={Icon.plus} onClick={() => setSheetOpen(true)}>
                    Create Alert
                  </Btn>
                }
              />
            ) : isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {alerts.map((alert) => (
                  <AlertCard
                    key={alert.alert_id}
                    alert={alert}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              <ActiveAlertsTable
                alerts={alerts}
                onToggle={handleToggle}
                onDelete={handleDelete}
                isValidating={isValidating}
              />
            )
          ) : (
            !hasLoaded ? (
              <SkeletonBlock />
            ) : history.length === 0 ? (
              <EmptyState
                icon={<ClockIcon />}
                title="No triggered alerts yet"
                description="Alerts that fire will appear here."
              />
            ) : isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {history.map((item) => (
                  <HistoryCard key={item.history_id} item={item} />
                ))}
              </div>
            ) : (
              <TriggeredHistoryTable history={history} />
            )
          )}
        </div>
      </div>

      <CreateAlertSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCreate={handleCreate}
      />
    </AppFrame>
  );
}

/* ─── TabsHeader ─── */

function TabsHeader({
  tab,
  onTab,
  activeCount,
  historyCount,
  padX,
}: {
  tab: "active" | "history";
  onTab: (t: "active" | "history") => void;
  activeCount: number;
  historyCount: number;
  padX: string;
  onCreateAlert: () => void;
}) {
  const T = useT();
  const tabs: { id: "active" | "history"; label: string; count: number }[] = [
    { id: "active", label: "Active Alerts", count: activeCount },
    { id: "history", label: "Triggered History", count: historyCount },
  ];
  return (
    <div
      style={{
        display: "flex",
        padding: `0 ${padX}`,
        borderBottom: `1px solid ${T.outlineFaint}`,
        gap: 0,
      }}
    >
      {tabs.map(({ id, label, count }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            style={{
              padding: "10px 16px",
              fontFamily: T.fontMono,
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              color: active ? T.primaryLight : T.text3,
              background: "transparent",
              border: "none",
              borderBottom: active ? `2px solid ${T.primaryLight}` : "2px solid transparent",
              marginBottom: -1,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {label} ({count})
          </button>
        );
      })}
    </div>
  );
}

/* ─── ActiveAlertsTable (desktop) ─── */

function ActiveAlertsTable({
  alerts,
  onToggle,
  onDelete,
  isValidating,
}: {
  alerts: AlertResponse[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  isValidating: boolean;
}) {
  const T = useT();
  return (
    <div style={{ fontFamily: T.fontMono, fontSize: 12, opacity: isValidating ? 0.7 : 1, transition: "opacity 0.15s" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "48px 1fr 180px 90px 90px 90px 44px",
          padding: "8px 0",
          borderBottom: `1px solid ${T.outlineVariant}`,
          fontSize: 10.5,
          color: T.text3,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {["", "Symbol / Name", "Condition", "Current", "Status", "Created", ""].map((h, i) => (
          <div key={i} style={{ padding: "0 12px", textAlign: i >= 3 ? "right" : "left" }}>{h}</div>
        ))}
      </div>
      {alerts.map((alert) => (
        <AlertRow key={alert.alert_id} alert={alert} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </div>
  );
}

/* ─── AlertRow ─── */

function AlertRow({
  alert,
  onToggle,
  onDelete,
}: {
  alert: AlertResponse;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const T = useT();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "48px 1fr 180px 90px 90px 90px 44px",
        padding: "10px 0",
        borderBottom: `1px dotted ${T.outlineFaint}`,
        alignItems: "center",
      }}
    >
      {/* Toggle */}
      <div style={{ padding: "0 12px" }}>
        <ToggleSwitch
          checked={alert.is_enabled}
          onChange={() => onToggle(alert.alert_id)}
          aria-label={`Toggle alert for ${alert.symbol}`}
        />
      </div>
      {/* Symbol */}
      <div style={{ padding: "0 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: T.fontMono, fontWeight: 600, fontSize: 13, color: T.text }}>
            {alert.symbol}
          </span>
          {alert.stock_name && (
            <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.text3 }}>
              {alert.stock_name}
            </span>
          )}
          {alert.note && (
            <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.text3, fontStyle: "italic" }}>
              {alert.note}
            </span>
          )}
        </div>
      </div>
      {/* Condition */}
      <div style={{ padding: "0 12px", color: T.text2, fontSize: 12 }}>
        {formatCondition(alert.condition, alert.target_price)}
      </div>
      {/* Current price */}
      <div style={{ padding: "0 12px", textAlign: "right", color: T.text2, fontVariantNumeric: "tabular-nums" }}>
        {alert.current_price !== null ? alert.current_price.toFixed(2) : "—"}
      </div>
      {/* Status pill */}
      <div style={{ padding: "0 12px", textAlign: "right" }}>
        <StatusPill alert={alert} />
      </div>
      {/* Created */}
      <div style={{ padding: "0 12px", textAlign: "right", color: T.text3 }}>
        {formatRelative(alert.created_at)}
      </div>
      {/* Delete */}
      <div style={{ padding: "0 12px", display: "flex", justifyContent: "flex-end" }}>
        <IconBtn title="Delete alert" danger onClick={() => onDelete(alert.alert_id)}>
          <TrashIcon />
        </IconBtn>
      </div>
    </div>
  );
}

/* ─── AlertCard (mobile) ─── */

function AlertCard({
  alert,
  onToggle,
  onDelete,
}: {
  alert: AlertResponse;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const T = useT();
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 8,
        background: T.surfaceLow,
        boxShadow: `0 0 0 1px ${T.outlineFaint}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: T.fontMono, fontWeight: 700, fontSize: 14, color: T.text }}>
            {alert.symbol}
          </span>
          {alert.stock_name && (
            <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.text3 }}>{alert.stock_name}</span>
          )}
          <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.text2, marginTop: 2 }}>
            {formatCondition(alert.condition, alert.target_price)}
          </span>
          {alert.note && (
            <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.text3, fontStyle: "italic" }}>
              {alert.note}
            </span>
          )}
        </div>
        <StatusPill alert={alert} />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          paddingTop: 10,
          borderTop: `1px solid ${T.outlineFaint}`,
        }}
      >
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
          Current:{" "}
          <span style={{ color: T.text2 }}>
            {alert.current_price !== null ? `${alert.current_price.toFixed(2)} PKR` : "—"}
          </span>
          <span style={{ marginLeft: 12 }}>{formatRelative(alert.created_at)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ToggleSwitch
            checked={alert.is_enabled}
            onChange={() => onToggle(alert.alert_id)}
            aria-label={`Toggle alert for ${alert.symbol}`}
          />
          <IconBtn title="Delete alert" danger onClick={() => onDelete(alert.alert_id)}>
            <TrashIcon />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

/* ─── TriggeredHistoryTable (desktop) ─── */

function TriggeredHistoryTable({ history }: { history: AlertHistoryItem[] }) {
  const T = useT();
  return (
    <div style={{ fontFamily: T.fontMono, fontSize: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 180px 90px 100px 100px",
          padding: "8px 0",
          borderBottom: `1px solid ${T.outlineVariant}`,
          fontSize: 10.5,
          color: T.text3,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {["Symbol / Name", "Condition", "Target", "Triggered At", "Time"].map((h, i) => (
          <div key={i} style={{ padding: "0 12px", textAlign: i >= 2 ? "right" : "left" }}>{h}</div>
        ))}
      </div>
      {history.map((item) => (
        <div
          key={item.history_id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 180px 90px 100px 100px",
            padding: "10px 0",
            borderBottom: `1px dotted ${T.outlineFaint}`,
            alignItems: "center",
          }}
        >
          <div style={{ padding: "0 12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{item.symbol}</span>
              {item.stock_name && (
                <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.text3 }}>{item.stock_name}</span>
              )}
            </div>
          </div>
          <div style={{ padding: "0 12px", color: T.text2 }}>
            {formatCondition(item.condition, item.target_price)}
          </div>
          <div style={{ padding: "0 12px", textAlign: "right", color: T.text2, fontVariantNumeric: "tabular-nums" }}>
            {item.target_price.toFixed(2)}
          </div>
          <div style={{ padding: "0 12px", textAlign: "right", color: T.accent ?? T.primaryLight, fontVariantNumeric: "tabular-nums" }}>
            {item.triggered_price.toFixed(2)}
          </div>
          <div
            style={{ padding: "0 12px", textAlign: "right", color: T.text3 }}
            title={item.triggered_at ?? ""}
          >
            {formatRelative(item.triggered_at)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── HistoryCard (mobile) ─── */

function HistoryCard({ item }: { item: AlertHistoryItem }) {
  const T = useT();
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 8,
        background: T.surfaceLow,
        boxShadow: `0 0 0 1px ${T.outlineFaint}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <span style={{ fontFamily: T.fontMono, fontWeight: 700, fontSize: 14, color: T.text }}>{item.symbol}</span>
          {item.stock_name && (
            <div style={{ fontFamily: T.fontSans, fontSize: 11, color: T.text3, marginTop: 2 }}>{item.stock_name}</div>
          )}
          <div style={{ fontFamily: T.fontSans, fontSize: 12, color: T.text2, marginTop: 4 }}>
            {formatCondition(item.condition, item.target_price)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 13, color: T.accent ?? T.primaryLight, fontVariantNumeric: "tabular-nums" }}>
            {item.triggered_price.toFixed(2)} PKR
          </div>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3, marginTop: 2 }} title={item.triggered_at ?? ""}>
            {formatRelative(item.triggered_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── StatusPill ─── */

function StatusPill({ alert }: { alert: AlertResponse }) {
  const T = useT();
  if (alert.is_triggered) {
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontFamily: T.fontSans,
        fontWeight: 600,
        background: "#d9891822",
        color: "#d98918",
      }}>
        triggered
      </span>
    );
  }
  if (!alert.is_enabled) {
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontFamily: T.fontSans,
        fontWeight: 500,
        background: T.surface3,
        color: T.text3,
      }}>
        disabled
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 10.5,
      fontFamily: T.fontSans,
      fontWeight: 500,
      background: "#1f5c3f22",
      color: "#1f9d5c",
    }}>
      enabled
    </span>
  );
}

/* ─── ToggleSwitch ─── */

function ToggleSwitch({
  checked,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  "aria-label"?: string;
}) {
  const T = useT();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? T.primary : T.outlineVariant,
        border: "none",
        cursor: "pointer",
        padding: 2,
        transition: "background 0.15s",
        minWidth: 36,
        minHeight: 44,
        justifyContent: "flex-start",
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          display: "block",
          transform: checked ? "translateX(16px)" : "translateX(0)",
          transition: "transform 0.15s",
          flexShrink: 0,
        }}
      />
    </button>
  );
}

/* ─── EmptyState ─── */

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const T = useT();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 24px",
        textAlign: "center",
        gap: 12,
      }}
    >
      <span style={{ color: T.text3, display: "flex" }}>{icon}</span>
      <div style={{ fontFamily: T.fontSans, fontSize: 15, fontWeight: 600, color: T.text }}>{title}</div>
      <div style={{ fontFamily: T.fontSans, fontSize: 13, color: T.text3, fontStyle: "italic", maxWidth: 320 }}>
        {description}
      </div>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

/* ─── Skeleton ─── */

function Skeleton({ width, height }: { width?: string | number; height?: number }) {
  const T = useT();
  return (
    <div style={{ width: width ?? "100%", height: height ?? 16, borderRadius: 4, background: T.surface3, opacity: 0.7 }} />
  );
}

function SkeletonBlock() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
      {[80, 70, 60, 75, 65].map((w, i) => (
        <Skeleton key={i} width={`${w}%`} height={18} />
      ))}
    </div>
  );
}

/* ─── ToastBar ─── */

function ToastBar({ message, padX }: { message: string; padX: string }) {
  const T = useT();
  return (
    <div
      style={{
        padding: `8px ${padX}`,
        background: T.primary + "18",
        borderBottom: `1px solid ${T.primary}33`,
        fontFamily: T.fontMono,
        fontSize: 11.5,
        color: T.primaryLight,
        letterSpacing: 0.3,
      }}
    >
      {message}
    </div>
  );
}

/* ─── IconBtn ─── */

function IconBtn({
  children,
  title,
  danger,
  onClick,
}: {
  children: ReactNode;
  title?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  const T = useT();
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: 6,
        background: "transparent",
        border: "none",
        color: danger ? T.loss : T.text3,
        cursor: "pointer",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

/* ─── CreateAlertSheet ─── */

const CONDITION_OPTIONS: { value: AlertCondition; label: string; description: string }[] = [
  { value: "ABOVE", label: "Price ≥ target", description: "Triggers when price rises to or above the target." },
  { value: "BELOW", label: "Price ≤ target", description: "Triggers when price falls to or below the target." },
  { value: "CROSSES_ABOVE", label: "Crosses above target", description: "Triggers on the first close above the target from below." },
  { value: "CROSSES_BELOW", label: "Crosses below target", description: "Triggers on the first close below the target from above." },
];

function CreateAlertSheet({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (data: CreateAlertRequest) => Promise<void>;
}) {
  const T = useT();
  const { isMobile } = useBreakpoint();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockResponse[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockResponse | null>(null);
  const [symbol, setSymbol] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("ABOVE");
  const [targetPrice, setTargetPrice] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedStock(null);
      setSymbol("");
      setCondition("ABOVE");
      setTargetPrice("");
      setNote("");
      setSubmitting(false);
      setShowResults(false);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/stocks?page_size=20&active_only=true&search=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = (await res.json()) as { items: StockResponse[] };
          setSearchResults(data.items ?? []);
          setShowResults(true);
        }
      } catch {
        // silent
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  function selectStock(stock: StockResponse) {
    setSelectedStock(stock);
    setSymbol(stock.symbol);
    setSearchQuery(stock.symbol);
    setShowResults(false);
    setSearchResults([]);
  }

  const canSubmit = symbol.trim() !== "" && targetPrice !== "" && Number(targetPrice) > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({
        symbol: symbol.trim().toUpperCase(),
        condition,
        target_price: Number(targetPrice),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    } catch (err) {
      // Let parent handle error display
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  // Backdrop click to close
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onOpenChange(false);
  }

  const selectedConditionDesc = CONDITION_OPTIONS.find((o) => o.value === condition)?.description;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleBackdrop}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 49,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create Alert"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: isMobile ? "100%" : 400,
          zIndex: 50,
          background: T.surface,
          borderLeft: `1px solid ${T.outlineVariant}`,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms ease",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px 16px",
            borderBottom: `1px solid ${T.outlineFaint}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: T.fontHead, fontSize: 17, fontWeight: 600, color: T.text }}>
            Create Alert
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 6,
              background: "transparent",
              border: "none",
              color: T.text3,
              cursor: "pointer",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Stock search */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Stock
            </label>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 12px",
                  background: T.surface,
                  border: `1px solid ${T.outlineVariant}`,
                  borderRadius: 6,
                }}
              >
                <span style={{ color: T.text3, display: "inline-flex", flexShrink: 0 }}>{Icon.search}</span>
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedStock) {
                      setSelectedStock(null);
                      setSymbol("");
                    }
                  }}
                  placeholder="Search symbol or company name…"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: T.text,
                    fontFamily: T.fontMono,
                    fontSize: 13,
                    width: "100%",
                    padding: 0,
                    outline: "none",
                  }}
                />
                {searchLoading && (
                  <span style={{ color: T.text3, fontSize: 11, flexShrink: 0 }}>…</span>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {showResults && searchResults.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    background: T.surface,
                    border: `1px solid ${T.outlineVariant}`,
                    borderRadius: 6,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    zIndex: 10,
                    maxHeight: 220,
                    overflowY: "auto",
                  }}
                >
                  {searchResults.map((stock) => (
                    <button
                      key={stock.id}
                      type="button"
                      onClick={() => selectStock(stock)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        padding: "10px 12px",
                        background: "transparent",
                        border: "none",
                        borderBottom: `1px solid ${T.outlineFaint}`,
                        cursor: "pointer",
                        textAlign: "left",
                        gap: 2,
                      }}
                    >
                      <span style={{ fontFamily: T.fontMono, fontSize: 13, fontWeight: 600, color: T.text }}>
                        {stock.symbol}
                      </span>
                      {stock.name && (
                        <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.text3 }}>{stock.name}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected stock chip */}
            {selectedStock && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  background: T.surface3,
                  borderRadius: 6,
                  fontFamily: T.fontMono,
                  fontSize: 12,
                }}
              >
                <span style={{ fontWeight: 700, color: T.text }}>{selectedStock.symbol}</span>
                {selectedStock.name && (
                  <span style={{ color: T.text3 }}>{selectedStock.name}</span>
                )}
                {selectedStock.last_close !== null && selectedStock.last_close !== undefined && (
                  <span style={{ color: T.text2 }}>{selectedStock.last_close.toFixed(2)} PKR</span>
                )}
              </div>
            )}
          </div>

          {/* Condition */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Condition
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as AlertCondition)}
              style={{
                padding: "9px 12px",
                background: T.surface,
                color: T.text,
                border: `1px solid ${T.outlineVariant}`,
                borderRadius: 6,
                fontFamily: T.fontSans,
                fontSize: 13,
                outline: "none",
                cursor: "pointer",
              }}
            >
              {CONDITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {selectedConditionDesc && (
              <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.text3 }}>
                {selectedConditionDesc}
              </span>
            )}
          </div>

          {/* Target price */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Target Price (PKR)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder={
                selectedStock?.last_close !== null && selectedStock?.last_close !== undefined
                  ? `Current: ${selectedStock.last_close.toFixed(2)}`
                  : "0.00"
              }
              style={{
                padding: "9px 12px",
                background: T.surface,
                color: T.text,
                border: `1px solid ${T.outlineVariant}`,
                borderRadius: 6,
                fontFamily: T.fontMono,
                fontSize: 13,
                outline: "none",
                width: "100%",
              }}
            />
          </div>

          {/* Note */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Note <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              maxLength={500}
              placeholder="e.g. Break above key resistance"
              style={{
                padding: "9px 12px",
                background: T.surface,
                color: T.text,
                border: `1px solid ${T.outlineVariant}`,
                borderRadius: 6,
                fontFamily: T.fontSans,
                fontSize: 13,
                outline: "none",
                width: "100%",
              }}
            />
            {note.length > 0 && (
              <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3, textAlign: "right" }}>
                {note.length}/500
              </span>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Submit */}
          <Btn
            variant="primary"
            size="md"
            type="submit"
            disabled={!canSubmit || submitting}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {submitting ? "Creating…" : "Create Alert"}
          </Btn>
        </form>
      </div>
    </>
  );
}

/* ─── SVG icons ─── */

function BellIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
