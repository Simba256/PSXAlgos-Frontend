"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut, useSession } from "next-auth/react";
import { useT } from "./theme";

function initialsFromName(name?: string | null, email?: string | null): string {
  const source = (name ?? email ?? "").trim();
  if (!source) return "·";
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({
  size = 26,
  fallback,
}: {
  size?: number;
  fallback?: ReactNode;
}) {
  const T = useT();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "loading") {
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          background: T.surface3,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
    );
  }

  if (!session?.user) return <>{fallback ?? null}</>;

  const { name, email, image } = session.user;
  const initials = initialsFromName(name, email);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          background: T.surface3,
          color: T.text2,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: T.fontMono,
          fontSize: Math.max(10, Math.round(size * 0.42)),
          fontWeight: 600,
          padding: 0,
          border: open ? `1px solid ${T.primaryLight}` : `1px solid transparent`,
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 240,
            background: T.surface,
            border: `1px solid ${T.outlineFaint}`,
            borderRadius: 10,
            boxShadow: `0 20px 50px -20px rgba(0,0,0,0.45)`,
            padding: 6,
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: "10px 12px 12px",
              borderBottom: `1px solid ${T.outlineFaint}`,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontFamily: T.fontHead,
                fontSize: 13,
                fontWeight: 600,
                color: T.text,
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name || "Signed in"}
            </div>
            {email && (
              <div
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  color: T.text3,
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {email}
              </div>
            )}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: "/" });
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "9px 12px",
              fontFamily: T.fontSans,
              fontSize: 13,
              color: T.text,
              background: "transparent",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.surface2;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
