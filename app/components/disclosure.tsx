"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import { useT } from "./theme";

// Generic collapsible section with a chevron, summary line, and animated
// expand/collapse via grid-template-rows (cross-browser, no JS height
// measurement). Used for nesting numeric filters under the universe block,
// hiding "configuration changed" diagnostics, etc.
//
// The body is always rendered (so it stays focusable for AT users on iOS
// VoiceOver) but hidden via grid sizing + overflow:hidden when collapsed.
export function Disclosure({
  label,
  summary,
  open,
  onToggle,
  children,
  tone = "default",
}: {
  label: string;
  /** One-line summary shown next to the label when collapsed. */
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** "muted" matches advanced-options affordances; default is regular. */
  tone?: "default" | "muted";
}) {
  const T = useT();
  const id = useId();
  const labelColor = tone === "muted" ? T.text3 : T.text2;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          padding: "6px 0",
          margin: 0,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          color: labelColor,
          fontFamily: T.fontMono,
          fontSize: 11,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            transform: `rotate(${open ? 90 : 0}deg)`,
            transition: "transform 240ms cubic-bezier(0.77, 0, 0.175, 1)",
            color: T.text3,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M3 1.5 L7 5 L3 8.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>{label}</span>
        {summary != null && !open && (
          <span
            style={{
              marginLeft: "auto",
              color: T.text3,
              fontFamily: T.fontMono,
              fontSize: 10.5,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            {summary}
          </span>
        )}
      </button>
      <div
        id={id}
        className="psx-disclosure-body"
        data-open={open ? "true" : "false"}
      >
        <div
          className="psx-disclosure-inner"
          aria-hidden={!open}
          style={{ paddingTop: open ? 12 : 0, transition: "padding-top 240ms" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
