"use client";

import { MarketingNav, SkipLink } from "@/components/frame";
import { useT } from "@/components/theme";
import { ALL_VARIANTS } from "@/components/logo-variants";
import { useBreakpoint, PAD, pick } from "@/components/responsive";

export default function BrandLabPage() {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.pageMarketing);

  const families = Array.from(new Set(ALL_VARIANTS.map((v) => v.family)));

  return (
    <div style={{ minHeight: "100dvh", background: T.surface, color: T.text }}>
      <SkipLink />
      <MarketingNav badge="brand-lab" />

      <main id="main-content" style={{ padding: `32px ${padX} 80px`, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.text3,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            ── LOGO EXPLORATION · INTERNAL
          </div>
          <h1
            style={{
              fontFamily: T.fontHead,
              fontSize: "clamp(32px, 5vw, 52px)",
              fontWeight: 700,
              letterSpacing: -1.5,
              margin: 0,
              marginBottom: 12,
            }}
          >
            Twenty-five candidates.
          </h1>
          <p style={{ fontFamily: T.fontSans, fontSize: 16, color: T.text2, maxWidth: 640, lineHeight: 1.5 }}>
            Each variant is rendered at 96px (hero), 28px (nav), and 16px (favicon size). Toggle Paper/Amber in the nav
            to see how each behaves across themes. Notes describe tradeoffs.
          </p>
        </div>

        {families.map((family) => {
          const rows = ALL_VARIANTS.filter((v) => v.family === family);
          return (
            <section key={family} style={{ marginBottom: 56 }}>
              <div
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  color: T.text3,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 16,
                  paddingBottom: 8,
                  borderBottom: `1px solid ${T.outlineFaint}`,
                }}
              >
                {family}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 16,
                }}
              >
                {rows.map((v) => {
                  const Comp = v.component;
                  return (
                    <div
                      key={v.id}
                      style={{
                        border: `1px solid ${T.outlineFaint}`,
                        borderRadius: 10,
                        padding: 20,
                        background: T.surfaceLow,
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div style={{ fontFamily: T.fontHead, fontSize: 15, fontWeight: 600 }}>
                          {v.id.toUpperCase()} · {v.name}
                        </div>
                        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.text3 }}>{family}</div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-end",
                          gap: 18,
                          padding: "16px 0 8px",
                          borderTop: `1px solid ${T.outlineFaint}`,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <Comp size={96} />
                          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.text3 }}>96</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <Comp size={28} />
                          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.text3 }}>28</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <Comp size={16} />
                          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.text3 }}>16</div>
                        </div>
                      </div>

                      <div style={{ fontFamily: T.fontSans, fontSize: 12.5, color: T.text2, lineHeight: 1.5 }}>
                        {v.notes}
                      </div>

                      {/* In-context nav preview */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          background: T.surface,
                          border: `1px solid ${T.outlineFaint}`,
                          borderRadius: 6,
                          marginTop: 2,
                        }}
                      >
                        <Comp size={28} radius={6} />
                        <span
                          style={{
                            fontFamily: T.fontHead,
                            fontSize: 15,
                            fontWeight: 600,
                            letterSpacing: -0.3,
                          }}
                        >
                          PSX Algos
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
