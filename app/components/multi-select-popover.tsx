"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useT } from "./theme";
import { Icon } from "./icons";

// cmdk-style popover combobox for multi-select with many options. Used for
// sector selection (~36 options). Selected items render as chips above the
// trigger; the popover hosts a search input + checkbox list. Items are
// NOT reordered on selection (per Linear pattern — reorder disorients).
//
// The "selected on top" pattern is intentionally avoided: chips above the
// trigger answer the "what's selected" question without animating items
// inside the list.

export interface MSOption {
  value: string;
  /** Optional secondary text shown right-aligned in the row. */
  hint?: string;
}

export function MultiSelectPopover({
  label,
  placeholder,
  options,
  selected,
  onChange,
  disabled,
  emptyHint = "no matches",
  triggerSummary,
}: {
  label: string;
  placeholder: string;
  options: MSOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  emptyHint?: string;
  /** Optional override for the trigger's collapsed summary. */
  triggerSummary?: string;
}) {
  const T = useT();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.value.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    // Focus the search input on open without scrolling the page.
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(v: string) {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  }

  const triggerLabel = (() => {
    if (triggerSummary) return triggerSummary;
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) return selected[0];
    return `${selected[0]} +${selected.length - 1} more`;
  })();

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "9px 12px",
          background: T.surface,
          color: selected.length === 0 ? T.text3 : T.text,
          border: "none",
          boxShadow: `0 0 0 1px ${T.outlineFaint}`,
          borderRadius: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          fontFamily: T.fontSans,
          fontSize: 12.5,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {triggerLabel}
        </span>
        <span aria-hidden style={{ color: T.text3, lineHeight: 0 }}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 4.5 L6 8 L10 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {selected.map((s) => (
            <SelectedChip key={s} label={s} onRemove={() => toggle(s)} disabled={disabled} />
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            style={{
              background: "transparent",
              border: "none",
              color: T.text3,
              fontFamily: T.fontMono,
              fontSize: 10.5,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              padding: "4px 6px",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            clear
          </button>
        </div>
      )}

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            width: "min(360px, 100%)",
            background: T.surface2,
            borderRadius: 10,
            boxShadow: `0 0 0 1px ${T.outlineFaint}, 0 16px 40px -12px rgba(0,0,0,0.45)`,
            animation: "psx-pop-in 140ms ease-out",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: 320,
          }}
        >
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.outlineFaint}` }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="search…"
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: T.text,
                fontFamily: T.fontMono,
                fontSize: 12.5,
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "4px 0" }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "10px 14px",
                  color: T.text3,
                  fontFamily: T.fontMono,
                  fontSize: 11,
                }}
              >
                {emptyHint}
              </div>
            ) : (
              filtered.map((opt) => {
                const active = selected.includes(opt.value);
                return (
                  <Row
                    key={opt.value}
                    active={active}
                    onClick={() => toggle(opt.value)}
                    label={opt.value}
                    hint={opt.hint}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
}) {
  const T = useT();
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      style={{
        appearance: "none",
        background: active ? T.surface3 : "transparent",
        border: "none",
        width: "100%",
        textAlign: "left",
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        color: T.text,
        fontFamily: T.fontSans,
        fontSize: 12.5,
        transition: "background 120ms ease",
      }}
    >
      <CheckBox checked={active} />
      <span style={{ flex: 1 }}>{label}</span>
      {hint && (
        <span
          style={{
            color: T.text3,
            fontFamily: T.fontMono,
            fontSize: 10.5,
          }}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  const T = useT();
  return (
    <span
      aria-hidden
      style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        boxShadow: `0 0 0 1px ${checked ? T.primary : T.outlineFaint}`,
        background: checked ? T.primary : "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        flexShrink: 0,
        transition: "background 120ms, box-shadow 120ms",
      }}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 9 9">
          <path d="M1.5 4.5 L3.7 6.7 L7.5 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

function SelectedChip({
  label,
  onRemove,
  disabled,
  style,
}: {
  label: string;
  onRemove: () => void;
  disabled?: boolean;
  style?: CSSProperties;
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
        fontFamily: T.fontSans,
        fontSize: 11.5,
        color: T.text,
        ...style,
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${label}`}
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
