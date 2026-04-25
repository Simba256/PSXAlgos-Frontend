"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./theme";
import { LogoMark } from "./logo";

// Google "G" mark in its mandated brand colors. Kept inline (no external asset)
// so the button stays legible on any background without flashing.
function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const T = useT();
  const googleBtnRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<"idle" | "pending">("idle");

  useEffect(() => {
    if (!open) return;
    setStatus("idle");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => googleBtnRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleGoogle = () => {
    // Real Google OAuth integration goes here (e.g., NextAuth `signIn("google")`
    // or a Supabase/Auth.js call). Until the backend exists, flip to a
    // pending state so the user gets feedback without a fake auth success.
    setStatus("pending");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background:
          T.mode === "dark" ? "rgba(0,0,0,0.72)" : "rgba(26,24,21,0.32)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "psx-fade-in 140ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: T.surface,
          color: T.text,
          borderRadius: 14,
          boxShadow: `0 40px 80px -30px rgba(0,0,0,0.55), 0 0 0 1px ${T.outlineFaint}`,
          padding: "36px 28px 24px",
          width: "100%",
          maxWidth: 420,
          fontFamily: T.fontSans,
          animation: "psx-pop-in 180ms ease-out",
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 34,
            height: 34,
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
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3 3 L11 11 M11 3 L3 11"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <LogoMark size={44} radius={10} />
        </div>

        <h2
          id="auth-modal-title"
          style={{
            fontFamily: T.fontHead,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: -0.3,
            textAlign: "center",
            margin: "0 0 8px",
            color: T.text,
          }}
        >
          Sign in to{" "}
          <span style={{ fontStyle: "italic", fontWeight: 500, color: T.primaryLight }}>
            PSX Algos
          </span>
        </h2>

        <p
          style={{
            fontSize: 13,
            color: T.text3,
            textAlign: "center",
            margin: "0 0 24px",
            lineHeight: 1.55,
          }}
        >
          One click with Google. We&apos;ll create your account if you&apos;re new here.
        </p>

        <button
          ref={googleBtnRef}
          type="button"
          onClick={handleGoogle}
          disabled={status === "pending"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 8,
            background: T.mode === "dark" ? "#ffffff" : "#131314",
            color: T.mode === "dark" ? "#1f1f1f" : "#e3e3e3",
            border: `1px solid ${T.mode === "dark" ? "#dadce0" : "#8e918f"}`,
            fontFamily: T.fontSans,
            fontSize: 14,
            fontWeight: 500,
            cursor: status === "pending" ? "progress" : "pointer",
            boxShadow:
              T.mode === "dark"
                ? "0 1px 2px rgba(60,64,67,0.1)"
                : "0 1px 3px rgba(0,0,0,0.4)",
            opacity: status === "pending" ? 0.82 : 1,
          }}
        >
          <GoogleIcon />
          {status === "pending" ? "Connecting to Google…" : "Continue with Google"}
        </button>

        {status === "pending" && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 6,
              background: T.surfaceLow,
              border: `1px dashed ${T.outlineVariant}`,
              fontFamily: T.fontMono,
              fontSize: 11.5,
              color: T.text3,
              textAlign: "center",
              lineHeight: 1.45,
            }}
          >
            <span style={{ color: T.primaryLight }}>◉</span> Google sign-in is being
            wired up — it&apos;ll work in the next cut.
          </div>
        )}

        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: `1px solid ${T.outlineFaint}`,
            fontFamily: T.fontMono,
            fontSize: 10.5,
            color: T.text3,
            textAlign: "center",
            lineHeight: 1.6,
            letterSpacing: 0.2,
          }}
        >
          By continuing you agree to our{" "}
          <span style={{ color: T.text2, textDecoration: "underline" }}>Terms</span>
          {" · "}
          <span style={{ color: T.text2, textDecoration: "underline" }}>Privacy</span>
        </div>
      </div>
    </div>
  );
}
