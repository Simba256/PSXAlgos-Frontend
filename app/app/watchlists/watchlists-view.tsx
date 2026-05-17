"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import { useBreakpoint, PAD, pick } from "@/components/responsive";
import {
  Btn,
  EditorialHeader,
  Kicker,
  Ribbon,
  TerminalTable,
  type Col,
} from "@/components/atoms";
import { Icon } from "@/components/icons";
import {
  useWatchlists,
  useWatchlist,
  useStockPriceMap,
  type StockPriceMap,
} from "@/lib/hooks/use-watchlists";
import { useSectorPerformance } from "@/lib/hooks/use-market";
import type { SectorPerformanceResponse } from "@/lib/api/market";
import {
  createWatchlist,
  updateWatchlist,
  deleteWatchlist,
  addSymbol,
  removeSymbol,
  removeSector,
  reorderSymbols,
  type WatchlistResponse,
  type WatchlistItemResponse,
} from "@/lib/api/watchlists";

/* ─── WatchlistsView ─── */

export function WatchlistsView() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { data: listData, hasLoaded, mutate: mutateList } = useWatchlists();
  const { data: detail, mutate: mutateDetail } = useWatchlist(activeId);
  const { priceMap } = useStockPriceMap();
  const { data: sectorPerf } = useSectorPerformance();

  // Select first watchlist on initial load.
  useEffect(() => {
    if (activeId === null && listData && listData.watchlists.length > 0) {
      setActiveId(listData.watchlists[0].watchlist_id);
    }
  }, [listData, activeId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCreate(name: string) {
    try {
      const res = await createWatchlist({ name });
      await mutateList();
      if (res.watchlist_id) setActiveId(res.watchlist_id);
      showToast(`Created "${name}"`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create");
    }
  }

  async function handleRename(id: number, name: string) {
    try {
      await updateWatchlist(id, { name });
      await mutateList();
      if (activeId === id) await mutateDetail();
      showToast("Renamed");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to rename");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteWatchlist(id);
      const remaining = listData?.watchlists.filter((w) => w.watchlist_id !== id) ?? [];
      await mutateList();
      if (activeId === id) {
        setActiveId(remaining.length > 0 ? remaining[0].watchlist_id : null);
      }
      showToast("Deleted");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleAddSymbol(symbol: string) {
    if (!activeId) return;
    try {
      await addSymbol(activeId, { symbol });
      await mutateDetail();
      await mutateList();
      showToast(`Added ${symbol}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Could not add ${symbol}`);
    }
  }

  async function handleRemoveSymbol(symbol: string) {
    if (!activeId) return;
    try {
      await removeSymbol(activeId, symbol);
      await mutateDetail();
      await mutateList();
      showToast(`Removed ${symbol}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Could not remove ${symbol}`);
    }
  }

  async function handleRemoveSector(sectorId: number) {
    if (!activeId) return;
    try {
      await removeSector(activeId, sectorId);
      await mutateDetail();
      await mutateList();
      showToast("Removed sector");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not remove sector");
    }
  }

  async function handleReorderUp(symbol: string) {
    if (!detail || !activeId) return;
    const stockItems = detail.items
      .filter((it) => it.symbol !== null)
      .sort((a, b) => a.position - b.position);
    const idx = stockItems.findIndex((it) => it.symbol === symbol);
    if (idx <= 0) return;
    const newOrder = stockItems.map((it) => it.symbol!);
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    try {
      await reorderSymbols(activeId, { symbols: newOrder });
      await mutateDetail();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reorder");
    }
  }

  async function handleReorderDown(symbol: string) {
    if (!detail || !activeId) return;
    const stockItems = detail.items
      .filter((it) => it.symbol !== null)
      .sort((a, b) => a.position - b.position);
    const idx = stockItems.findIndex((it) => it.symbol === symbol);
    if (idx < 0 || idx >= stockItems.length - 1) return;
    const newOrder = stockItems.map((it) => it.symbol!);
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    try {
      await reorderSymbols(activeId, { symbols: newOrder });
      await mutateDetail();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reorder");
    }
  }

  const watchlists = listData?.watchlists ?? [];
  const active = detail ?? watchlists.find((w) => w.watchlist_id === activeId) ?? null;
  const isEmpty = hasLoaded && watchlists.length === 0;

  return (
    <AppFrame route="/watchlists">
      <Body
        watchlists={watchlists}
        active={active}
        activeId={activeId}
        hasLoaded={hasLoaded}
        isEmpty={isEmpty}
        toast={toast}
        priceMap={priceMap}
        sectorPerf={sectorPerf ?? []}
        onSelect={setActiveId}
        onCreate={handleCreate}
        onRename={handleRename}
        onDelete={handleDelete}
        onAddSymbol={handleAddSymbol}
        onRemoveSymbol={handleRemoveSymbol}
        onRemoveSector={handleRemoveSector}
        onReorderUp={handleReorderUp}
        onReorderDown={handleReorderDown}
      />
    </AppFrame>
  );
}

/* ─── Body ─── */

interface BodyProps {
  watchlists: WatchlistResponse[];
  active: WatchlistResponse | null;
  activeId: number | null;
  hasLoaded: boolean;
  isEmpty: boolean;
  toast: string | null;
  priceMap: StockPriceMap;
  sectorPerf: SectorPerformanceResponse[];
  onSelect: (id: number) => void;
  onCreate: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onAddSymbol: (symbol: string) => void;
  onRemoveSymbol: (symbol: string) => void;
  onRemoveSector: (sectorId: number) => void;
  onReorderUp: (symbol: string) => void;
  onReorderDown: (symbol: string) => void;
}

function Body({
  watchlists,
  active,
  activeId,
  hasLoaded,
  isEmpty,
  toast,
  priceMap,
  sectorPerf,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onAddSymbol,
  onRemoveSymbol,
  onRemoveSector,
  onReorderUp,
  onReorderDown,
}: BodyProps) {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);

  const symbolCount = active?.items.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <EditorialHeader
        kicker="saved symbol lists · your research"
        title={
          <>
            Watchlists{" "}
            {active && (
              <>
                <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>·</span>{" "}
                <span style={{ color: T.primaryLight, fontWeight: 400 }}>{active.name}</span>
              </>
            )}
          </>
        }
        meta={
          active ? (
            <span>{symbolCount} symbol{symbolCount !== 1 ? "s" : ""}</span>
          ) : hasLoaded && !isEmpty ? (
            <span>Select a watchlist</span>
          ) : null
        }
        actions={
          <Btn variant="primary" size="sm" icon={Icon.plus} onClick={() => onCreate("New List")}>
            New list
          </Btn>
        }
      />

      {toast && <ToastBar message={toast} padX={padX} />}

      {isEmpty ? (
        <EmptyState onCreate={onCreate} padX={padX} isMobile={isMobile} />
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            overflow: "hidden",
          }}
        >
          {isMobile ? (
            <WatchlistMobileSelector
              watchlists={watchlists}
              activeId={activeId}
              onSelect={onSelect}
            />
          ) : (
            <WatchlistSidebar
              watchlists={watchlists}
              activeId={activeId}
              onSelect={onSelect}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={onDelete}
            />
          )}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: pick(bp, {
                mobile: `20px ${padX} 28px`,
                desktop: `28px ${padX} 40px`,
              }),
              borderLeft: isMobile ? "none" : `1px solid ${T.outlineFaint}`,
            }}
          >
            {active ? (
              <>
                <AddSymbolInput onAdd={onAddSymbol} />
                <div style={{ marginTop: 20 }}>
                  {active.items.length === 0 ? (
                    <EmptyWatchlist />
                  ) : (
                    <WatchlistTable
                      items={active.items}
                      priceMap={priceMap}
                      sectorPerf={sectorPerf}
                      isMobile={isMobile}
                      onRemoveSymbol={onRemoveSymbol}
                      onRemoveSector={onRemoveSector}
                      onReorderUp={onReorderUp}
                      onReorderDown={onReorderDown}
                    />
                  )}
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: "40px 0",
                  fontSize: 13,
                  color: T.text3,
                  fontStyle: "italic",
                  fontFamily: T.fontMono,
                }}
              >
                Select a watchlist from the sidebar.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── WatchlistMobileSelector ─── */

function WatchlistMobileSelector({
  watchlists,
  activeId,
  onSelect,
}: {
  watchlists: WatchlistResponse[];
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  const T = useT();
  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: `1px solid ${T.outlineFaint}`,
        background: T.surfaceLow,
      }}
    >
      <select
        value={activeId ?? ""}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v) onSelect(v);
        }}
        style={{
          width: "100%",
          padding: "8px 10px",
          background: T.surface,
          color: T.text,
          border: `1px solid ${T.outlineFaint}`,
          borderRadius: 6,
          fontFamily: T.fontSans,
          fontSize: 13,
          outline: "none",
        }}
      >
        {watchlists.map((w) => (
          <option key={w.watchlist_id} value={w.watchlist_id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── WatchlistSidebar ─── */

interface WatchlistSidebarProps {
  watchlists: WatchlistResponse[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onCreate: (name: string) => void;
  onRename: (id: number, newName: string) => void;
  onDelete: (id: number) => void;
}

function WatchlistSidebar({
  watchlists,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: WatchlistSidebarProps) {
  const T = useT();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const createRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) createRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (editingId !== null) editRef.current?.focus();
  }, [editingId]);

  function submitCreate() {
    const name = newName.trim();
    if (name) onCreate(name);
    setCreating(false);
    setNewName("");
  }

  function submitEdit(id: number) {
    const name = editName.trim();
    if (name) onRename(id, name);
    setEditingId(null);
    setEditName("");
  }

  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        overflowY: "auto",
        borderRight: `1px solid ${T.outlineFaint}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "14px 16px 10px",
          borderBottom: `1px solid ${T.outlineFaint}`,
        }}
      >
        <Kicker>My lists</Kicker>
      </div>

      <div style={{ flex: 1, paddingTop: 4 }}>
        {watchlists.map((w) => (
          <WatchlistRow
            key={w.watchlist_id}
            watchlist={w}
            active={activeId === w.watchlist_id}
            isEditing={editingId === w.watchlist_id}
            editName={editName}
            editRef={editRef}
            onSelect={() => onSelect(w.watchlist_id)}
            onStartEdit={() => { setEditingId(w.watchlist_id); setEditName(w.name); }}
            onEditChange={setEditName}
            onEditSubmit={() => submitEdit(w.watchlist_id)}
            onEditCancel={() => { setEditingId(null); setEditName(""); }}
            onDelete={() => onDelete(w.watchlist_id)}
          />
        ))}
      </div>

      <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.outlineFaint}` }}>
        {creating ? (
          <input
            ref={createRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
            onBlur={submitCreate}
            placeholder="Watchlist name…"
            style={inlineInputStyle(T)}
          />
        ) : (
          <Btn
            variant="ghost"
            size="sm"
            icon={Icon.plus}
            onClick={() => { setCreating(true); setNewName(""); }}
            style={{ width: "100%", justifyContent: "flex-start" }}
          >
            New list
          </Btn>
        )}
      </div>
    </div>
  );
}

/* ─── WatchlistRow ─── */

function WatchlistRow({
  watchlist,
  active,
  isEditing,
  editName,
  editRef,
  onSelect,
  onStartEdit,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  onDelete,
}: {
  watchlist: WatchlistResponse;
  active: boolean;
  isEditing: boolean;
  editName: string;
  editRef: React.RefObject<HTMLInputElement | null>;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
  onDelete: () => void;
}) {
  const T = useT();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 16px",
        background: active ? T.primary + "14" : hovered ? T.surface3 : "transparent",
        borderLeft: `2px solid ${active ? T.primary : "transparent"}`,
        gap: 4,
        cursor: "pointer",
        transition: "background 0.1s",
      }}
    >
      {isEditing ? (
        <input
          ref={editRef}
          value={editName}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditSubmit();
            if (e.key === "Escape") onEditCancel();
          }}
          onBlur={onEditSubmit}
          style={{ ...inlineInputStyle(T), flex: 1, minWidth: 0 }}
        />
      ) : (
        <span
          onClick={onSelect}
          style={{
            flex: 1,
            fontSize: 13,
            fontFamily: T.fontSans,
            color: active ? T.primary : T.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {watchlist.name}
        </span>
      )}
      {(hovered || active) && !isEditing && (
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <IconBtn title="Rename" onClick={onStartEdit}>
            {Icon.more}
          </IconBtn>
          <IconBtn title="Delete" danger onClick={onDelete}>
            {Icon.close}
          </IconBtn>
        </div>
      )}
    </div>
  );
}

/* ─── WatchlistTable ─── */

interface TableItem {
  item: WatchlistItemResponse;
  lastClose: number | null;
  changePct: number | null;
  isFirst: boolean;
  isLast: boolean;
}

function WatchlistTable({
  items,
  priceMap,
  sectorPerf,
  isMobile,
  onRemoveSymbol,
  onRemoveSector,
  onReorderUp,
  onReorderDown,
}: {
  items: WatchlistItemResponse[];
  priceMap: StockPriceMap;
  sectorPerf: SectorPerformanceResponse[];
  isMobile: boolean;
  onRemoveSymbol: (symbol: string) => void;
  onRemoveSector: (sectorId: number) => void;
  onReorderUp: (symbol: string) => void;
  onReorderDown: (symbol: string) => void;
}) {
  const T = useT();
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const stockItems = sorted.filter((it) => it.symbol !== null);

  const tableItems: TableItem[] = sorted.map((item) => {
    let lastClose: number | null = null;
    let changePct: number | null = null;

    if (item.item_type === "SECTOR") {
      const sp = sectorPerf.find((s) => s.sector === item.name);
      if (sp) changePct = sp.avg_change_percent;
    } else if (item.symbol) {
      const p = priceMap[item.symbol];
      if (p) {
        lastClose = p.last_close ?? null;
        changePct = p.last_change_pct ?? null;
      }
    }

    const symIdx = item.symbol
      ? stockItems.findIndex((it) => it.symbol === item.symbol)
      : -1;
    return {
      item,
      lastClose,
      changePct,
      isFirst: symIdx === 0,
      isLast: symIdx === stockItems.length - 1,
    };
  });

  const cols: Col[] = [
    { label: "type", width: "52px" },
    { label: "symbol / name", width: "1fr", primary: true, mono: false },
    ...(isMobile ? [] : [{ label: "last", align: "right" as const, width: "80px" }]),
    { label: "chg %", align: "right" as const, width: "76px" },
    { label: "", width: "60px" },
  ];

  const rows: TableItem[][] = tableItems.map((ti) => [ti, ti, ti, ti, ...(isMobile ? [] : [ti])]);

  return (
    <TerminalTable
      cols={cols}
      rows={rows}
      renderCell={(cell, ci) => {
        const { item, lastClose, changePct, isFirst, isLast } = cell as TableItem;

        const typeColors: Record<string, string> = {
          STOCK: T.text3,
          INDEX: T.accent,
          SECTOR: T.deploy,
        };
        const typeLabels: Record<string, string> = {
          STOCK: "STK",
          INDEX: "IDX",
          SECTOR: "SCT",
        };

        if (ci === 0) {
          return (
            <span
              style={{
                fontSize: 10,
                fontFamily: T.fontMono,
                letterSpacing: 0.4,
                color: typeColors[item.item_type] ?? T.text3,
              }}
            >
              {typeLabels[item.item_type] ?? item.item_type}
            </span>
          );
        }
        if (ci === 1) {
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span
                style={{
                  color: T.text,
                  fontWeight: 600,
                  fontFamily: T.fontMono,
                  fontSize: 12,
                }}
              >
                {item.symbol ?? item.name}
              </span>
              {item.symbol && (
                <span style={{ color: T.text3, fontFamily: T.fontSans, fontSize: 11 }}>
                  {item.name}
                </span>
              )}
            </div>
          );
        }

        // On desktop: ci=2 is "last", ci=3 is "chg %", ci=4 is actions.
        // On mobile: ci=2 is "chg %", ci=3 is actions (no "last" column).
        const lastCol = isMobile ? -1 : 2;
        const chgCol = isMobile ? 2 : 3;
        const actCol = isMobile ? 3 : 4;

        if (ci === lastCol) {
          if (item.item_type === "SECTOR" || lastClose === null) {
            return <span style={{ color: T.text3 }}>—</span>;
          }
          return (
            <span style={{ color: T.text2, fontVariantNumeric: "tabular-nums" }}>
              {lastClose.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          );
        }
        if (ci === chgCol) {
          if (changePct === null) {
            return <span style={{ color: T.text3 }}>—</span>;
          }
          return (
            <span
              style={{
                color: changePct >= 0 ? T.gain : T.loss,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
          );
        }
        if (ci === actCol) {
          return (
            <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
              {item.symbol !== null && (
                <>
                  <IconBtn
                    title="Move up"
                    disabled={isFirst}
                    onClick={() => onReorderUp(item.symbol!)}
                  >
                    <ChevUpIcon />
                  </IconBtn>
                  <IconBtn
                    title="Move down"
                    disabled={isLast}
                    onClick={() => onReorderDown(item.symbol!)}
                  >
                    <ChevDownIcon />
                  </IconBtn>
                </>
              )}
              <IconBtn
                title="Remove"
                danger
                onClick={() => {
                  if (item.item_type === "SECTOR" && item.sector_id !== null) {
                    onRemoveSector(item.sector_id);
                  } else if (item.symbol) {
                    onRemoveSymbol(item.symbol);
                  }
                }}
              >
                {Icon.close}
              </IconBtn>
            </div>
          );
        }
        return null;
      }}
    />
  );
}

/* ─── AddSymbolInput ─── */

function AddSymbolInput({ onAdd }: { onAdd: (symbol: string) => void }) {
  const T = useT();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const sym = value.trim().toUpperCase();
    if (!sym) return;
    setSubmitting(true);
    try {
      await onAdd(sym);
      setValue("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: T.surface,
          borderRadius: 6,
          boxShadow: `0 0 0 1px ${T.outlineFaint}`,
        }}
      >
        <span style={{ color: T.text3, display: "inline-flex" }}>{Icon.search}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="Add symbol — e.g. OGDC"
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
      </div>
      <Btn
        variant="primary"
        size="sm"
        icon={Icon.plus}
        onClick={() => void submit()}
        disabled={submitting || !value.trim()}
      >
        Add
      </Btn>
    </div>
  );
}

/* ─── EmptyWatchlist ─── */

function EmptyWatchlist() {
  const T = useT();
  return (
    <div
      style={{
        padding: "24px 0",
        fontSize: 13,
        color: T.text3,
        fontStyle: "italic",
        borderTop: `1px solid ${T.outlineFaint}`,
      }}
    >
      Your watchlist is empty. Search for a stock above to add it here.
    </div>
  );
}

/* ─── EmptyState (no watchlists) ─── */

function EmptyState({
  onCreate,
  padX,
  isMobile,
}: {
  onCreate: (name: string) => void;
  padX: string;
  isMobile: boolean;
}) {
  const T = useT();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const n = name.trim();
    if (!n) return;
    setSubmitting(true);
    try {
      await onCreate(n);
      setName("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: isMobile ? `28px ${padX}` : `48px ${padX}`,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr",
          gap: isMobile ? 32 : 48,
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        <div>
          <Kicker>saved lists</Kicker>
          <h2
            style={{
              fontFamily: T.fontHead,
              fontSize: "clamp(28px, 6vw, 44px)",
              fontWeight: 500,
              margin: "14px 0 18px",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            Track{" "}
            <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>
              the stocks you care about
            </span>
            .
          </h2>
          <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.7, maxWidth: 520 }}>
            Watchlists let you group symbols by sector, theme, or strategy and scan them at a glance.
            Create your first list to get started.
          </p>
          <div
            style={{
              marginTop: 22,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: T.surface,
                borderRadius: 6,
                boxShadow: `0 0 0 1px ${T.outlineFaint}`,
              }}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
                placeholder="Name your first list"
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.text,
                  fontFamily: T.fontSans,
                  fontSize: 13,
                  width: 200,
                  padding: 0,
                  outline: "none",
                }}
              />
            </div>
            <Btn
              variant="primary"
              size="md"
              icon={Icon.plus}
              onClick={() => void submit()}
              disabled={submitting || !name.trim()}
            >
              Create list
            </Btn>
          </div>
        </div>
        <div>
          <Kicker>what you can do</Kicker>
          <div style={{ marginTop: 14 }}>
            <Ribbon kicker="organize" />
            <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.7, margin: "8px 0 16px" }}>
              Group symbols by theme — tech, cement, banks, or high-conviction picks. Each list is
              yours alone.
            </p>
            <Ribbon kicker="scan" />
            <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.7, margin: "8px 0 0" }}>
              See last close price and daily change for every symbol at a glance. Add or remove
              anytime.
            </p>
          </div>
        </div>
      </div>
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

/* ─── Shared helpers ─── */

function inlineInputStyle(T: ReturnType<typeof useT>): CSSProperties {
  return {
    background: T.surface,
    border: `1px solid ${T.outlineFaint}`,
    borderRadius: 4,
    padding: "5px 8px",
    fontSize: 12.5,
    fontFamily: T.fontSans,
    color: T.text,
    outline: "none",
    width: "100%",
  };
}

function IconBtn({
  children,
  title,
  disabled,
  danger,
  onClick,
}: {
  children: ReactNode;
  title?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  const T = useT();
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: 3,
        background: "transparent",
        border: "none",
        color: danger ? T.loss : T.text3,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function ChevUpIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 7l3-3 3 3" />
    </svg>
  );
}

function ChevDownIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 3l3 3 3-3" />
    </svg>
  );
}
