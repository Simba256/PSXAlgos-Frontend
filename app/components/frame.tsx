"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useT, useTheme } from "./theme";
import { useBreakpoint, PAD, pick } from "./responsive";
import { LogoMark } from "./logo";
import { AuthModal } from "./auth-modal";
import { UserMenu } from "./user-menu";

type MarketingItem =
  | { kind: "link"; href: string; label: string }
  | { kind: "stub"; label: string };

// Backtest is reached downstream from /strategies (open a strategy → click
// Backtest pin / Run backtest). A bare nav entry would always land on the
// "open this from a strategy" empty state because /backtest requires
// ?strategy_id=N to hydrate.
const NAV_ITEMS: MarketingItem[] = [
  { kind: "link", href: "/strategies", label: "Strategies" },
  { kind: "link", href: "/signals", label: "Signals" },
  { kind: "link", href: "/bots", label: "Bots" },
  { kind: "link", href: "/portfolio", label: "Portfolio" },
];

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

export function TopNav({ route }: { route?: string }) {
  const T = useT();
  const pathname = usePathname();
  const activeRoute = route || pathname;
  const { isDesktop } = useBreakpoint();
  const compact = !isDesktop;
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open && compact);

  useEffect(() => {
    if (!compact && open) setOpen(false);
  }, [compact, open]);

  return (
    <header
      style={{
        background: T.surface,
        borderBottom: `1px solid ${T.outlineFaint}`,
        flexShrink: 0,
        position: "relative",
        zIndex: 40,
      }}
    >
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "stretch",
          padding: compact ? "0 16px" : "0 24px",
          gap: compact ? 8 : 0,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginRight: compact ? 0 : 28,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <LogoMark size={20} radius={4} />
          <span style={{ fontFamily: T.fontHead, fontWeight: 600, fontSize: 14, letterSpacing: -0.2 }}>
            PSX{" "}
            <span style={{ fontStyle: "italic", fontWeight: 500, color: T.primaryLight }}>Algos</span>
          </span>
        </Link>

        {!compact && (
          <nav style={{ display: "flex", flex: 1, minWidth: 0 }}>
            {NAV_ITEMS.map((item) => {
              if (item.kind !== "link") return null;
              const active = activeRoute?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href as "/strategies"}
                  style={{
                    padding: "0 16px",
                    fontSize: 12.5,
                    display: "flex",
                    alignItems: "center",
                    color: active ? T.text : T.text3,
                    borderBottom: active ? `2px solid ${T.primaryLight}` : "2px solid transparent",
                    marginBottom: -1,
                    fontFamily: T.fontSans,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {compact ? (
          <>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                alignSelf: "center",
                background: "transparent",
                border: `1px solid ${T.outlineFaint}`,
                borderRadius: 6,
                color: T.text,
                cursor: "pointer",
              }}
            >
              <Hamburger open={open} color={T.text} />
            </button>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              color: T.text3,
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            <ThemeToggle variant="inline" />
            <span style={{ fontFamily: T.fontMono, whiteSpace: "nowrap" }}>
              KSE-100 <span style={{ color: T.gain }}>+0.42%</span>
            </span>
            <UserMenu size={26} />
          </div>
        )}
      </div>

      {compact && open && (
        <MobileDrawer
          onClose={() => setOpen(false)}
          items={NAV_ITEMS}
          activeRoute={activeRoute}
          footer={
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ThemeToggle variant="inline" />
              <div
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 12,
                  color: T.text3,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>KSE-100</span>
                <span style={{ color: T.gain }}>+0.42%</span>
              </div>
            </div>
          }
        />
      )}
    </header>
  );
}

export function MarketingNav({ badge }: { badge?: string }) {
  const T = useT();
  const { isDesktop, bp } = useBreakpoint();
  const compact = !isDesktop;
  const [authOpen, setAuthOpen] = useState(false);

  // proxy.ts redirects gated routes to /?auth=required&from=<path> when no
  // session. Pop the modal automatically when we land here with that flag,
  // then strip the query so a refresh doesn't re-trigger. Reads
  // window.location directly inside the effect instead of useSearchParams()
  // so static-prerendered pages (e.g. /brand) don't bail out of SSG.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("auth") !== "required") return;
    setAuthOpen(true);
    url.searchParams.delete("auth");
    url.searchParams.delete("from");
    const cleaned = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
    window.history.replaceState(null, "", cleaned);
  }, []);

  const padX = pick(bp, PAD.pageMarketing);

  return (
    <header
      style={{
        borderBottom: `1px solid ${T.outlineFaint}`,
        background: T.surface,
        position: "relative",
        zIndex: 40,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: compact ? `14px ${padX}` : `22px ${padX}`,
          gap: 12,
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}
        >
          <LogoMark size={28} radius={6} />
          <span
            style={{
              fontFamily: T.fontHead,
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: -0.3,
            }}
          >
            PSX Algos
          </span>
          {badge && !compact && (
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3, marginLeft: 12 }}>
              / {badge}
            </span>
          )}
        </Link>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: compact ? 6 : 10, alignItems: "center" }}>
          {!compact && <ThemeToggle variant="inline" />}
          <Link
            href="/pricing"
            style={{
              fontFamily: T.fontMono,
              fontSize: 11.5,
              color: T.text2,
              padding: "8px 14px",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            Pricing
          </Link>
          <UserMenu
            size={30}
            fallback={
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 11.5,
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: T.primary,
                  color: T.surface,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Sign in
              </button>
            }
          />
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}

function Hamburger({ open, color }: { open: boolean; color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d={open ? "M5 5 L15 15 M15 5 L5 15" : "M3 6 H17 M3 10 H17 M3 14 H17"}
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MobileDrawer({
  onClose,
  items,
  activeRoute,
  onStub,
  footer,
}: {
  onClose: () => void;
  items: MarketingItem[];
  activeRoute?: string | null;
  onStub?: (label: string) => void;
  footer?: ReactNode;
}) {
  const T = useT();
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        background: T.surface,
        borderBottom: `1px solid ${T.outlineFaint}`,
        boxShadow: `0 16px 32px -16px ${
          T.mode === "dark" ? "rgba(0,0,0,0.6)" : "rgba(26,24,21,0.18)"
        }`,
        padding: "8px 16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        maxHeight: "calc(100dvh - 60px)",
        overflowY: "auto",
      }}
    >
      {items.map((item) => {
        if (item.kind === "stub") {
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onStub?.(item.label)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "14px 4px",
                fontFamily: T.fontSans,
                fontSize: 15,
                color: T.text,
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${T.outlineFaint}`,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          );
        }
        const active = activeRoute?.startsWith(item.href);
        return (
          <Link
            key={item.label}
            href={item.href as "/strategies"}
            onClick={onClose}
            style={{
              display: "block",
              padding: "14px 4px",
              fontFamily: T.fontSans,
              fontSize: 15,
              color: active ? T.primaryLight : T.text,
              borderBottom: `1px solid ${T.outlineFaint}`,
              fontWeight: active ? 600 : 400,
            }}
          >
            {item.label}
          </Link>
        );
      })}
      {footer && <div style={{ marginTop: 16 }}>{footer}</div>}
    </div>
  );
}

export function AppFrame({
  children,
  route,
}: {
  children: ReactNode;
  route?: string;
}) {
  const T = useT();
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: T.surface,
        color: T.text,
        fontFamily: T.fontSans,
        fontSize: 13,
        lineHeight: 1.5,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SkipLink />
      <TopNav route={route} />
      <main
        id="main-content"
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        {children}
      </main>
    </div>
  );
}

// Visually hidden until focused — keyboard users tab once from the address
// bar and can jump straight past the nav. WCAG 2.4.1 Bypass Blocks (Level A).
export function SkipLink() {
  const T = useT();
  return (
    <a
      href="#main-content"
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        padding: "8px 14px",
        background: T.surface2,
        color: T.text,
        borderRadius: 6,
        border: `1px solid ${T.outlineVariant}`,
        fontFamily: T.fontSans,
        fontSize: 13,
        fontWeight: 500,
        zIndex: 9999,
        transform: "translateY(-120%)",
        transition: "transform 140ms ease",
      }}
      onFocus={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.transform = "translateY(-120%)";
      }}
    >
      Skip to main content
    </a>
  );
}

export function ThemeToggle({ variant = "floating" }: { variant?: "floating" | "inline" } = {}) {
  const T = useT();
  const { mode, setMode } = useTheme();
  const darkBg = mode === "dark";
  const inline = variant === "inline";

  const containerStyle = inline
    ? {
        display: "flex",
        alignItems: "center",
        gap: 2,
        background: T.surface3,
        border: `1px solid ${T.outlineFaint}`,
        padding: 2,
        borderRadius: 999,
        fontFamily: T.fontMono,
        fontSize: 10.5,
      }
    : {
        position: "fixed" as const,
        top: 12,
        right: 16,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: darkBg ? "rgba(255,244,220,0.92)" : "rgba(26,24,21,0.92)",
        backdropFilter: "blur(12px)",
        padding: 3,
        borderRadius: 999,
        boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
        fontFamily: 'var(--font-plex-mono), "IBM Plex Mono", ui-monospace, monospace',
        fontSize: 11,
      };

  return (
    <div style={containerStyle}>
      {(
        [
          ["light", "☀ Paper"],
          ["dark", "◐ Amber"],
        ] as const
      ).map(([m, label]) => {
        const active = mode === m;
        const buttonStyle = inline
          ? {
              minHeight: 24,
              padding: "6px 12px",
              borderRadius: 999,
              border: "none",
              background: active ? T.surface : "transparent",
              color: active ? T.primaryLight : T.text3,
              fontFamily: "inherit",
              fontSize: "inherit",
              cursor: "pointer",
              letterSpacing: 0.3,
              fontWeight: 600,
              boxShadow: active ? `0 1px 2px ${T.mode === "dark" ? "rgba(0,0,0,0.5)" : "rgba(26,24,21,0.08)"}` : "none",
            }
          : {
              padding: "6px 14px",
              borderRadius: 999,
              border: "none",
              background: active ? (darkBg ? "#0a0906" : "#f7f3ea") : "transparent",
              color: active
                ? darkBg
                  ? "#d9881a"
                  : "#1f5c3f"
                : darkBg
                ? "rgba(26,24,21,0.72)"
                : "rgba(255,244,220,0.78)",
              fontFamily: "inherit",
              fontSize: "inherit",
              cursor: "pointer",
              letterSpacing: 0.3,
              fontWeight: 600,
            };
        return (
          <button key={m} type="button" onClick={() => setMode(m)} style={buttonStyle}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
