"use client";

// Shared universe + risk picker for bot creation, backtest creation, and
// strategy deploy. Mirrors `BacktestRequest` / `BotCreate` / `DeployRequest`
// on the backend (psxDataPortal/backend/app/schemas/strategy.py:440 +
// .../bot.py:48 + .../signal.py).
//
// `value` and `onChange` cover the union of fields. `showRisk` toggles the
// guardrail block off for the deploy modal (where only universe matters).

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useT } from "./theme";
import { Kicker } from "./atoms";

// Mirrors backend StockFilters (strategy.py:321). All fields optional;
// missing or null means "no constraint on this dimension".
export interface StockFilters {
  sectors?: string[] | null;
  min_price?: number | null;
  max_price?: number | null;
  min_volume?: number | null;
  min_market_cap?: number | null;
}

export interface UniverseAndRiskValue {
  // Universe — one or both. An explicit symbol allowlist takes precedence
  // over filters in the backend engine when both are set.
  stock_filters: StockFilters | null;
  stock_symbols: string[] | null;

  // Risk guardrails — only meaningful when the parent shows the risk block
  // (bot create + backtest create). For the deploy modal these stay null.
  stop_loss_pct?: number | null;
  take_profit_pct?: number | null;
  trailing_stop_pct?: number | null;
  max_holding_days?: number | null;
  max_positions?: number | null;
}

export const EMPTY_UNIVERSE_AND_RISK: UniverseAndRiskValue = {
  stock_filters: null,
  stock_symbols: null,
};

export interface SymbolOption {
  symbol: string;
  name?: string | null;
}

export function UniverseAndRiskFields({
  value,
  onChange,
  availableSectors,
  availableSymbols,
  showRisk = true,
  disabled = false,
}: {
  value: UniverseAndRiskValue;
  onChange: (next: UniverseAndRiskValue) => void;
  availableSectors: string[];
  availableSymbols: SymbolOption[];
  showRisk?: boolean;
  disabled?: boolean;
}) {
  const filters = value.stock_filters ?? {};
  const symbols = value.stock_symbols ?? [];

  // Patch helpers preserve null when a section becomes empty so the backend
  // stores NULL instead of `{}` / `[]` (matches deploy + B044 semantics).
  function patchFilters(next: Partial<StockFilters>) {
    const merged: StockFilters = { ...filters, ...next };
    const isEmpty =
      (!merged.sectors || merged.sectors.length === 0) &&
      merged.min_price == null &&
      merged.max_price == null &&
      merged.min_volume == null &&
      merged.min_market_cap == null;
    onChange({ ...value, stock_filters: isEmpty ? null : merged });
  }

  function patchSymbols(next: string[]) {
    onChange({ ...value, stock_symbols: next.length === 0 ? null : next });
  }

  function toggleSector(name: string) {
    const cur = filters.sectors ?? [];
    const next = cur.includes(name) ? cur.filter((s) => s !== name) : [...cur, name];
    patchFilters({ sectors: next.length === 0 ? null : next });
  }

  function addSymbol(sym: string) {
    const norm = sym.trim().toUpperCase();
    if (!norm) return;
    if (symbols.includes(norm)) return;
    patchSymbols([...symbols, norm]);
  }

  function removeSymbol(sym: string) {
    patchSymbols(symbols.filter((s) => s !== sym));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Section
        kicker="universe · sectors"
        info="Pick one or more sectors. The strategy will scan every active stock in the chosen sectors."
      >
        <SectorChips
          available={availableSectors}
          selected={filters.sectors ?? []}
          onToggle={toggleSector}
          disabled={disabled}
        />
      </Section>

      <Section
        kicker="universe · explicit symbols"
        info="Optional. Add tickers to lock the universe to those symbols only — overrides sectors and filters."
      >
        <SymbolPicker
          available={availableSymbols}
          selected={symbols}
          onAdd={addSymbol}
          onRemove={removeSymbol}
          disabled={disabled}
        />
        {symbols.length === 0 && filters.sectors && filters.sectors.length > 0 && (
          <FaintNote>using sectors above — no explicit allowlist</FaintNote>
        )}
      </Section>

      <Section kicker="universe · filters" info="Optional numeric guardrails. Leave blank to skip.">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
            maxWidth: 640,
          }}
        >
          <NumberInput
            label="min price (PKR)"
            value={filters.min_price ?? null}
            onChange={(v) => patchFilters({ min_price: v })}
            disabled={disabled}
            min={0}
          />
          <NumberInput
            label="max price (PKR)"
            value={filters.max_price ?? null}
            onChange={(v) => patchFilters({ max_price: v })}
            disabled={disabled}
            min={0}
          />
          <NumberInput
            label="min daily volume"
            value={filters.min_volume ?? null}
            onChange={(v) => patchFilters({ min_volume: v })}
            disabled={disabled}
            min={0}
            integer
          />
          <NumberInput
            label="min market cap"
            value={filters.min_market_cap ?? null}
            onChange={(v) => patchFilters({ min_market_cap: v })}
            disabled={disabled}
            min={0}
          />
        </div>
      </Section>

      {showRisk && (
        <Section
          kicker="risk · guardrails"
          info="Hard caps applied per trade. Leave blank for none."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 14,
              maxWidth: 640,
            }}
          >
            <NumberInput
              label="stop loss %"
              value={value.stop_loss_pct ?? null}
              onChange={(v) => onChange({ ...value, stop_loss_pct: v })}
              disabled={disabled}
              min={0}
              max={100}
            />
            <NumberInput
              label="take profit %"
              value={value.take_profit_pct ?? null}
              onChange={(v) => onChange({ ...value, take_profit_pct: v })}
              disabled={disabled}
              min={0}
              max={100}
            />
            <NumberInput
              label="trailing stop %"
              value={value.trailing_stop_pct ?? null}
              onChange={(v) => onChange({ ...value, trailing_stop_pct: v })}
              disabled={disabled}
              min={0}
              max={100}
            />
            <NumberInput
              label="max holding days"
              value={value.max_holding_days ?? null}
              onChange={(v) => onChange({ ...value, max_holding_days: v })}
              disabled={disabled}
              min={1}
              integer
            />
            <NumberInput
              label="max concurrent positions"
              value={value.max_positions ?? null}
              onChange={(v) => onChange({ ...value, max_positions: v })}
              disabled={disabled}
              min={1}
              max={50}
              integer
            />
          </div>
        </Section>
      )}
    </div>
  );
}

function SectorChips({
  available,
  selected,
  onToggle,
  disabled,
}: {
  available: string[];
  selected: string[];
  onToggle: (name: string) => void;
  disabled: boolean;
}) {
  const T = useT();
  if (available.length === 0) return <FaintNote>no sectors loaded</FaintNote>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {available.map((sector) => {
        const active = selected.includes(sector);
        return (
          <button
            key={sector}
            type="button"
            onClick={() => onToggle(sector)}
            disabled={disabled}
            aria-pressed={active}
            style={{
              background: active ? T.surface3 : "transparent",
              color: active ? T.text : T.text2,
              border: `1px solid ${active ? T.outlineVariant : T.outlineFaint}`,
              borderRadius: 4,
              padding: "7px 12px",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              fontFamily: "inherit",
              fontSize: 12.5,
              transition:
                "background 120ms ease, color 120ms ease, border-color 120ms ease",
            }}
          >
            {sector}
          </button>
        );
      })}
    </div>
  );
}

// Inline symbol picker: text input + filtered suggestion dropdown, commits
// on Enter or on suggestion click. Doesn't use Combobox because we need a
// distinct "commit and add chip" event (Combobox's onChange fires on every
// keystroke, so we couldn't tell a partial typed value apart from a commit).
function SymbolPicker({
  available,
  selected,
  onAdd,
  onRemove,
  disabled,
}: {
  available: SymbolOption[];
  selected: string[];
  onAdd: (sym: string) => void;
  onRemove: (sym: string) => void;
  disabled: boolean;
}) {
  const T = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const exclude = new Set(selected);
    const starts: SymbolOption[] = [];
    const contains: SymbolOption[] = [];
    for (const opt of available) {
      if (exclude.has(opt.symbol)) continue;
      const sym = opt.symbol.toUpperCase();
      const name = (opt.name ?? "").toUpperCase();
      if (sym.startsWith(q)) starts.push(opt);
      else if (sym.includes(q) || name.includes(q)) contains.push(opt);
      if (starts.length + contains.length >= 8) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [query, available, selected]);

  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, matches.length - 1)));
  }, [matches.length]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function commit(sym: string) {
    onAdd(sym);
    setQuery("");
    setHighlight(0);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (matches.length === 0 ? 0 : (h + 1) % matches.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) =>
        matches.length === 0 ? 0 : (h - 1 + matches.length) % matches.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[highlight]) {
        commit(matches[highlight].symbol);
      } else if (query.trim()) {
        // Allow committing a free-typed symbol even if it isn't in the
        // loaded list — backend will normalize. Useful when /stocks hasn't
        // loaded yet, or for newly listed tickers.
        commit(query);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", maxWidth: 360 }}>
      <input
        type="text"
        value={query}
        placeholder="search and add a ticker"
        autoComplete="off"
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        style={{
          background: T.surface,
          color: T.text,
          border: "none",
          boxShadow: `0 0 0 1px ${T.outlineFaint}`,
          borderRadius: 6,
          padding: "9px 12px",
          fontFamily: T.fontMono,
          fontSize: 12.5,
          width: "100%",
          opacity: disabled ? 0.6 : 1,
        }}
      />
      {open && matches.length > 0 && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: T.surface2,
            borderRadius: 8,
            boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 12px 32px -12px rgba(0,0,0,0.5)`,
            maxHeight: 240,
            overflowY: "auto",
            zIndex: 10,
          }}
        >
          {matches.map((opt, i) => {
            const active = i === highlight;
            return (
              <div
                key={opt.symbol}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(opt.symbol);
                }}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  background: active ? T.surface3 : "transparent",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontFamily: T.fontMono, fontSize: 13, color: T.text }}>
                  {opt.symbol}
                </span>
                {opt.name && (
                  <span
                    style={{
                      fontFamily: T.fontSans,
                      fontSize: 11,
                      color: T.text3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "60%",
                    }}
                  >
                    {opt.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {selected.map((sym) => (
            <SymbolChip
              key={sym}
              sym={sym}
              onRemove={() => onRemove(sym)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Section({
  kicker,
  info,
  children,
}: {
  kicker: string;
  info?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Kicker info={info}>{kicker}</Kicker>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function FaintNote({ children }: { children: ReactNode }) {
  const T = useT();
  return (
    <div
      style={{
        fontFamily: T.fontMono,
        fontSize: 11,
        color: T.text3,
        marginTop: 4,
      }}
    >
      {children}
    </div>
  );
}

function SymbolChip({
  sym,
  onRemove,
  disabled,
}: {
  sym: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  const T = useT();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 6px 5px 10px",
        background: T.surface3,
        border: `1px solid ${T.outlineFaint}`,
        borderRadius: 999,
        fontFamily: T.fontMono,
        fontSize: 11.5,
        color: T.text,
      }}
    >
      {sym}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${sym}`}
        style={{
          background: "transparent",
          border: "none",
          color: T.text3,
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 13,
          padding: "0 4px",
          lineHeight: 1,
          fontFamily: "inherit",
        }}
      >
        ×
      </button>
    </span>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  disabled,
  min,
  max,
  integer = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
}) {
  const T = useT();
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 10,
          color: T.text3,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <input
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        value={value ?? ""}
        min={min}
        max={max}
        step={integer ? 1 : "any"}
        disabled={disabled}
        placeholder="—"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const n = integer ? parseInt(raw, 10) : parseFloat(raw);
          if (!Number.isFinite(n)) return;
          onChange(n);
        }}
        style={{
          background: T.surface,
          color: T.text,
          border: "none",
          boxShadow: `0 0 0 1px ${T.outlineFaint}`,
          borderRadius: 6,
          padding: "8px 10px",
          fontFamily: T.fontMono,
          fontSize: 12.5,
          width: "100%",
          opacity: disabled ? 0.6 : 1,
        }}
      />
    </label>
  );
}
