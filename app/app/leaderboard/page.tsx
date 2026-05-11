"use client";

import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import { useBreakpoint, PAD, pick } from "@/components/responsive";

export default function LeaderboardPage() {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);

  return (
    <AppFrame route="/leaderboard">
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: pick(bp, {
            mobile: `48px ${padX}`,
            desktop: `80px ${padX}`,
          }),
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: 460,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.text3,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 24,
                height: 1,
                background: T.outline,
                display: "inline-block",
              }}
            />
            Leaderboard
            <span
              style={{
                width: 24,
                height: 1,
                background: T.outline,
                display: "inline-block",
              }}
            />
          </div>

          <h1
            style={{
              fontFamily: T.fontHead,
              fontSize: isMobile ? 40 : 56,
              fontWeight: 500,
              margin: 0,
              letterSpacing: "-0.03em",
              color: T.text,
              lineHeight: 1.02,
            }}
          >
            Coming soon.
          </h1>

          <p
            style={{
              fontFamily: T.fontSans,
              fontSize: 15,
              lineHeight: 1.55,
              color: T.text3,
              margin: 0,
            }}
          >
            A public ranking of anonymized strategies on risk-adjusted,
            simulated metrics. Not live yet.
          </p>
        </div>
      </div>
    </AppFrame>
  );
}
