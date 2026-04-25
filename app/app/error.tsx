"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useT } from "@/components/theme";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const T = useT();

  useEffect(() => {
    // Real telemetry sink goes here once wired up. console.error keeps the
    // stack visible in dev and in browser consoles in prod.
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: T.surface,
        color: T.text,
        fontFamily: T.fontSans,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 10.5,
            color: T.text3,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          something broke
        </div>
        <h1
          style={{
            fontFamily: T.fontHead,
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: -0.5,
            margin: "0 0 12px",
            color: T.text,
          }}
        >
          This page hit a snag.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: T.text2,
            lineHeight: 1.55,
            margin: "0 0 24px",
          }}
        >
          Try reloading the segment, or head back home. If it keeps happening, the
          digest below helps trace it.
        </p>
        {error.digest && (
          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.text3,
              marginBottom: 24,
              padding: "8px 12px",
              background: T.surfaceLow,
              border: `1px solid ${T.outlineFaint}`,
              borderRadius: 6,
              wordBreak: "break-all",
            }}
          >
            digest: {error.digest}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              padding: "10px 18px",
              borderRadius: 6,
              background: T.primary,
              color: "#fff",
              border: "none",
              fontFamily: T.fontSans,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              padding: "10px 18px",
              borderRadius: 6,
              background: "transparent",
              color: T.text,
              border: `1px solid ${T.outlineVariant}`,
              fontFamily: T.fontSans,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
