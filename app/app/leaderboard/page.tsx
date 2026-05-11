"use client";

import Link from "next/link";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import { EditorialHeader } from "@/components/atoms";
import { useBreakpoint, PAD, pick } from "@/components/responsive";

// Public teaser. The real surface will rank anonymized strategies on
// risk-adjusted, simulated metrics — not people, not raw return. Wiring
// the route + nav slot in early so we can drop the live board in place
// without re-plumbing navigation.
export default function LeaderboardPage() {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);

  return (
    <AppFrame route="/leaderboard">
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <EditorialHeader
          kicker="Coming soon · public ranking"
          title="Leaderboard"
          meta={
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
              Strategies ranked · risk-adjusted · simulated
            </span>
          }
        />

        <div
          style={{
            flex: 1,
            padding: pick(bp, {
              mobile: `20px ${padX} 40px`,
              desktop: `40px ${padX} 64px`,
            }),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              border: `1px solid ${T.outlineFaint}`,
              borderRadius: 10,
              padding: pick(bp, { mobile: 24, desktop: 40 }),
              background: T.surface2,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontFamily: T.fontMono,
                fontSize: 11,
                color: T.primaryLight,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px",
                border: `1px solid ${T.primaryLight}`,
                borderRadius: 999,
                marginBottom: 18,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  background: T.primaryLight,
                  borderRadius: 999,
                  display: "inline-block",
                }}
              />
              In the works
            </div>

            <h2
              style={{
                fontFamily: T.fontHead,
                fontSize: isMobile ? 22 : 28,
                fontWeight: 500,
                margin: "0 0 14px",
                letterSpacing: "-0.02em",
                color: T.text,
                lineHeight: 1.15,
              }}
            >
              A public scoreboard for strategies, not signal sellers.
            </h2>

            <p
              style={{
                fontFamily: T.fontSans,
                fontSize: 14.5,
                lineHeight: 1.6,
                color: T.text2,
                margin: "0 0 14px",
              }}
            >
              We&apos;re building a leaderboard that ranks anonymized
              strategies on risk-adjusted, out-of-sample backtest metrics —
              drawdown, consistency, exposure — alongside raw return. The
              point is to surface methods worth studying, so the table
              reads like a track record, not a sales pitch.
            </p>

            <p
              style={{
                fontFamily: T.fontSans,
                fontSize: 14.5,
                lineHeight: 1.6,
                color: T.text2,
                margin: "0 0 22px",
              }}
            >
              It fits the arc the platform is built around — learn,
              understand, then earn from informed decisions. The
              leaderboard is the &quot;understand&quot; step out loud:
              evidence of what holds up over time.
            </p>

            <TeaserPreview />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 24,
              }}
            >
              <Link
                href="/strategies"
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 12,
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: T.primaryLight,
                  color: "#fff",
                  border: `1px solid ${T.primaryLight}`,
                  textDecoration: "none",
                }}
              >
                Build a strategy →
              </Link>
              <Link
                href="/backtest"
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 12,
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "transparent",
                  color: T.text2,
                  border: `1px solid ${T.outlineFaint}`,
                  textDecoration: "none",
                }}
              >
                Run a backtest
              </Link>
            </div>
          </div>

          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.text3,
              textAlign: "center",
              maxWidth: 520,
              lineHeight: 1.6,
            }}
          >
            No release date yet — we want the methodology and abuse
            controls right before we open the ranks. Watch this space.
          </div>
        </div>
      </div>
    </AppFrame>
  );
}

function TeaserPreview() {
  const T = useT();
  const rows = [
    { rank: 1, name: "Strategy ░░░░░░░", cagr: "—", maxDD: "—", sharpe: "—" },
    { rank: 2, name: "Strategy ░░░░░░░", cagr: "—", maxDD: "—", sharpe: "—" },
    { rank: 3, name: "Strategy ░░░░░░░", cagr: "—", maxDD: "—", sharpe: "—" },
  ];

  return (
    <div
      style={{
        border: `1px dashed ${T.outlineFaint}`,
        borderRadius: 8,
        overflow: "hidden",
        background: T.surface,
      }}
      aria-hidden
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40px 1fr 70px 70px 70px",
          padding: "10px 14px",
          fontFamily: T.fontMono,
          fontSize: 10.5,
          color: T.text3,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          borderBottom: `1px solid ${T.outlineFaint}`,
          gap: 8,
        }}
      >
        <span>#</span>
        <span>Strategy</span>
        <span style={{ textAlign: "right" }}>CAGR</span>
        <span style={{ textAlign: "right" }}>Max DD</span>
        <span style={{ textAlign: "right" }}>Sharpe</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.rank}
          style={{
            display: "grid",
            gridTemplateColumns: "40px 1fr 70px 70px 70px",
            padding: "12px 14px",
            fontFamily: T.fontMono,
            fontSize: 12,
            color: T.text3,
            borderBottom: `1px solid ${T.outlineFaint}`,
            gap: 8,
            opacity: 0.7,
          }}
        >
          <span>{r.rank}</span>
          <span style={{ letterSpacing: 1 }}>{r.name}</span>
          <span style={{ textAlign: "right" }}>{r.cagr}</span>
          <span style={{ textAlign: "right" }}>{r.maxDD}</span>
          <span style={{ textAlign: "right" }}>{r.sharpe}</span>
        </div>
      ))}
      <div
        style={{
          padding: "10px 14px",
          fontFamily: T.fontMono,
          fontSize: 10.5,
          color: T.text3,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        Sample shape · live ranks pending
      </div>
    </div>
  );
}
