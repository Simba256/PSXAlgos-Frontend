"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { useT } from "@/components/theme";
import { MarketingNav, SkipLink } from "@/components/frame";
import { useBreakpoint, PAD, pick, clampPx } from "@/components/responsive";

type Billing = "monthly" | "yearly";

interface Tier {
  name: string;
  price: string;
  period: string;
  blurb: string;
  cta: string;
  ctaVariant: "primary" | "outline" | "ghost";
  popular?: boolean;
  features: [string, ReactNode][];
  footnote?: string;
}

export interface PriceTable {
  // Monthly + yearly-total prices in PKR for each paid tier. `null`/missing
  // entries fall back to design defaults so the marketing page never blanks
  // out if the backend hiccups.
  pro?: { monthly: number; yearly: number } | null;
  quant?: { monthly: number; yearly: number } | null;
}

const FALLBACK_MONTHLY = { pro: 500, quant: 1500 } as const;
const FALLBACK_DISCOUNT = 0.2;

function tierPricing(
  name: "Free" | "Pro" | "Quant",
  billing: Billing,
  prices: PriceTable,
): Pick<Tier, "price" | "period" | "footnote"> {
  if (name === "Free") return { price: "PKR 0", period: "forever" };

  const live = name === "Pro" ? prices.pro : prices.quant;
  const fallbackMonthly = name === "Pro" ? FALLBACK_MONTHLY.pro : FALLBACK_MONTHLY.quant;
  const monthly = live?.monthly ?? fallbackMonthly;
  const yearlyTotal =
    live?.yearly ?? Math.round(monthly * 12 * (1 - FALLBACK_DISCOUNT));

  if (billing === "monthly") {
    return { price: `PKR ${monthly.toLocaleString()}`, period: "/month" };
  }

  const yearlyPerMonth = Math.round(yearlyTotal / 12);
  const fullYear = monthly * 12;
  const savedPct =
    fullYear > 0 ? Math.round(((fullYear - yearlyTotal) / fullYear) * 100) : 0;
  return {
    price: `PKR ${yearlyPerMonth.toLocaleString()}`,
    period: "/month",
    footnote: `PKR ${yearlyTotal.toLocaleString()} billed yearly${
      savedPct > 0 ? ` · save ${savedPct}%` : ""
    }`,
  };
}

export function PricingView({ prices }: { prices: PriceTable }) {
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.pageMarketing);
  const [billing, setBilling] = useState<Billing>("monthly");

  const tiers: Tier[] = [
    {
      name: "Free",
      ...tierPricing("Free", billing, prices),
      blurb:
        "Kick the tires. Build a couple strategies, run a handful of backtests, see if the edge is real.",
      cta: "Start free",
      ctaVariant: "ghost",
      features: [
        ["Strategies", "10 total"],
        ["Backtest history", "1 year"],
        ["Backtests / month", "3"],
        ["Signals", "1 deployed strategy"],
        ["Bots", "—"],
        ["Support", "Community"],
      ],
    },
    {
      name: "Pro",
      ...tierPricing("Pro", billing, prices),
      blurb:
        "For serious hobbyists. Explore dozens of variants, iterate fast, deploy to signals you trade manually.",
      cta: "Start 14-day trial",
      ctaVariant: "primary",
      popular: true,
      features: [
        ["Strategies", "50 / month"],
        ["Backtest history", "3 years"],
        ["Backtests / month", "50"],
        ["Signals", "Unlimited deployed"],
        ["Bots", "3 paper bots"],
        ["Support", "Email · 48h"],
      ],
    },
    {
      name: "Quant",
      ...tierPricing("Quant", billing, prices),
      blurb:
        "Full PSX firehose. Unlimited everything for anyone systematically trading the market.",
      cta: "Start 14-day trial",
      ctaVariant: "outline",
      features: [
        ["Strategies", "Unlimited"],
        [
          "Backtest history",
          <>
            <strong style={{ color: T.primaryLight }}>All of PSX</strong> · since 2015
          </>,
        ],
        ["Backtests / month", "Unlimited"],
        ["Signals", "Unlimited + webhooks"],
        ["Bots", "Unlimited"],
        ["Support", "Priority · 12h"],
      ],
    },
  ];

  const ctaStyles: Record<Tier["ctaVariant"], React.CSSProperties> = {
    primary: { background: T.primary, color: T.surface },
    outline: { background: "transparent", color: T.text, boxShadow: `inset 0 0 0 1.5px ${T.outline}` },
    ghost: { background: T.surfaceLow, color: T.text, boxShadow: `inset 0 0 0 1px ${T.outlineFaint}` },
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: T.surface,
        color: T.text,
        fontFamily: T.fontSans,
        fontSize: 14,
      }}
    >
      <SkipLink />
      <MarketingNav badge="pricing" />

      <main id="main-content">
      <div
        style={{
          padding: pick(bp, {
            mobile: `44px ${padX} 28px`,
            desktop: `72px ${padX} 40px`,
          }),
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.primaryLight,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          ── pricing
        </div>
        <h1
          style={{
            fontFamily: T.fontHead,
            fontSize: clampPx(34, 8, 64),
            fontWeight: 500,
            letterSpacing: "-0.025em",
            margin: "18px 0 16px",
            lineHeight: 1.02,
          }}
        >
          Pay for{" "}
          <span style={{ fontStyle: "italic", color: T.primaryLight }}>backtests,</span> not seats.
        </h1>
        <p
          style={{
            fontSize: pick(bp, { mobile: 14.5, desktop: 16 }),
            color: T.text2,
            maxWidth: 560,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Three tiers. PKR pricing. Cancel any time. No per-seat fees, no hidden usage meters — the
          plan you pick is the plan you get.
        </p>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginTop: 28,
            padding: 3,
            borderRadius: 999,
            background: T.surfaceLow,
            border: `1px solid ${T.outlineFaint}`,
            fontFamily: T.fontMono,
            fontSize: 11.5,
          }}
        >
          <BillingTab active={billing === "monthly"} onClick={() => setBilling("monthly")}>
            Monthly
          </BillingTab>
          <BillingTab active={billing === "yearly"} onClick={() => setBilling("yearly")}>
            Yearly <span style={{ color: T.gain }}>· save 20%</span>
          </BillingTab>
        </div>
      </div>

      {/* Tiers */}
      <div
        style={{
          padding: `0 ${padX} ${isMobile ? 40 : 60}px`,
          display: "grid",
          gridTemplateColumns: pick(bp, {
            mobile: "1fr",
            tablet: "1fr 1fr",
            desktop: "1fr 1fr 1fr",
          }),
          gap: 16,
          alignItems: "stretch",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        {tiers.map((tier) => (
          <div
            key={tier.name}
            style={{
              position: "relative",
              background: tier.popular ? T.surfaceLow : T.surface,
              borderRadius: 12,
              border: tier.popular ? `1.5px solid ${T.primary}` : `1px solid ${T.outlineFaint}`,
              padding: pick(bp, { mobile: 24, desktop: 32 }),
              display: "flex",
              flexDirection: "column",
              gap: 18,
              boxShadow: tier.popular
                ? `0 20px 60px -30px ${T.primary}55, 0 0 0 4px ${T.primary}11`
                : "none",
            }}
          >
            {tier.popular && (
              <span
                style={{
                  position: "absolute",
                  top: -11,
                  left: 24,
                  fontFamily: T.fontMono,
                  fontSize: 10,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: T.primary,
                  color: T.surface,
                  fontWeight: 600,
                }}
              >
                most popular
              </span>
            )}
            <div>
              <div
                style={{ fontFamily: T.fontHead, fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}
              >
                {tier.name}
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontFamily: T.fontHead,
                    fontSize: clampPx(32, 7, 44),
                    fontWeight: 500,
                    letterSpacing: -1,
                    color: T.text,
                  }}
                >
                  {tier.price}
                </span>
                <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.text3 }}>
                  {tier.period}
                </span>
              </div>
              {tier.footnote && (
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: T.fontMono,
                    fontSize: 11,
                    color: T.gain,
                  }}
                >
                  {tier.footnote}
                </div>
              )}
              <p
                style={{
                  fontSize: 12.5,
                  color: T.text2,
                  lineHeight: 1.55,
                  margin: "14px 0 0",
                  minHeight: isMobile ? 0 : 56,
                }}
              >
                {tier.blurb}
              </p>
            </div>

            <Link
              href="/strategies"
              style={{
                display: "block",
                textAlign: "center",
                fontFamily: T.fontHead,
                fontSize: 13.5,
                fontWeight: 600,
                padding: "12px 16px",
                borderRadius: 6,
                cursor: "pointer",
                ...ctaStyles[tier.ctaVariant],
              }}
            >
              {tier.cta} →
            </Link>

            <div style={{ height: 1, background: T.outlineFaint }} />

            <div style={{ display: "flex", flexDirection: "column" }}>
              {tier.features.map(([l, v], i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    padding: "10px 0",
                    borderBottom:
                      i < tier.features.length - 1 ? `1px dotted ${T.outlineFaint}` : "none",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ color: T.text3 }}>{l}</span>
                  <span
                    style={{
                      flex: 1,
                      borderBottom: `1px dotted ${T.outlineFaint}`,
                      transform: "translateY(-4px)",
                    }}
                  />
                  <span
                    style={{
                      color: T.text,
                      fontFamily: T.fontMono,
                      fontWeight: 500,
                      textAlign: "right",
                    }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: `0 ${padX} ${isMobile ? 40 : 60}px`,
          display: "grid",
          gridTemplateColumns: pick(bp, {
            mobile: "1fr",
            tablet: "1.3fr 1fr",
            desktop: "1.3fr 1fr",
          }),
          gap: pick(bp, { mobile: 32, desktop: 48 }),
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.primaryLight,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            ── side by side
          </div>
          {(() => {
            const rows = [
              ["Strategies created", "10", "50/mo", "unlimited"],
              ["Backtest lookback", "1 year", "3 years", "all of PSX"],
              ["Backtests / month", "3", "50", "unlimited"],
              ["Signals deployed", "1", "unlimited", "unlimited"],
              ["Paper-trading bots", "—", "3", "unlimited"],
              ["Webhook notifications", "—", "—", "✓"],
              ["CSV export", "✓", "✓", "✓"],
              ["Sector screener", "—", "✓", "✓"],
              ["Early access", "—", "—", "✓"],
              ["Support SLA", "community", "email · 48h", "priority · 12h"],
            ] satisfies ReadonlyArray<[string, string, string, string]>;

            if (isMobile) {
              return (
                <div style={{ fontFamily: T.fontMono, fontSize: 12 }}>
                  {rows.map((row, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "12px 0",
                        borderBottom: `1px dotted ${T.outlineFaint}`,
                      }}
                    >
                      <div style={{ color: T.text2, marginBottom: 8 }}>{row[0]}</div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 6,
                        }}
                      >
                        {(
                          [
                            ["free", row[1], T.text3, 400],
                            ["pro", row[2], T.primaryLight, 500],
                            ["quant", row[3], T.text3, 400],
                          ] as const
                        ).map(([label, value, labelColor, weight], j) => (
                          <div key={j}>
                            <div
                              style={{
                                fontSize: 9.5,
                                color: labelColor,
                                letterSpacing: 0.7,
                                textTransform: "uppercase",
                                marginBottom: 3,
                              }}
                            >
                              {label}
                            </div>
                            <div
                              style={{
                                color: value === "—" ? T.text3 : T.text,
                                fontWeight: value === "—" ? 400 : weight,
                              }}
                            >
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <div style={{ fontFamily: T.fontMono, fontSize: 12 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
                    padding: "10px 0",
                    borderBottom: `1px solid ${T.outline}`,
                    color: T.text3,
                    fontSize: 10.5,
                    letterSpacing: 0.7,
                    textTransform: "uppercase",
                  }}
                >
                  <span>feature</span>
                  <span>free</span>
                  <span style={{ color: T.primaryLight }}>pro</span>
                  <span>quant</span>
                </div>
                {rows.map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
                      alignItems: "center",
                      padding: "11px 0",
                      borderBottom: `1px dotted ${T.outlineFaint}`,
                    }}
                  >
                    <span style={{ color: T.text2 }}>{row[0]}</span>
                    <span style={{ color: row[1] === "—" ? T.text3 : T.text }}>{row[1]}</span>
                    <span
                      style={{ color: row[2] === "—" ? T.text3 : T.text, fontWeight: 500 }}
                    >
                      {row[2]}
                    </span>
                    <span style={{ color: row[3] === "—" ? T.text3 : T.text }}>{row[3]}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        <div>
          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.primaryLight,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            ── FAQ
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: 1, background: T.outlineFaint }}
          >
            {(
              [
                [
                  "Can I change plans later?",
                  "Anytime. Upgrades prorate to today. Downgrades kick in next billing cycle — your strategies stay put.",
                ],
                [
                  "What counts as a backtest?",
                  "One run of one strategy over one timeframe. Re-running the same config uses a cached result and is free.",
                ],
                [
                  "Is this connected to a broker?",
                  "No. PSX Algos is strategy authoring, signals, and paper-trading. You execute trades with your own broker and log them in the Portfolio.",
                ],
                [
                  "Do you offer academic pricing?",
                  "Yes — free Pro for verified students at Pakistani universities. Write in from a .edu.pk address.",
                ],
                [
                  "Can I pay annually?",
                  "Yes — 20% off and local bank transfer is accepted for annual plans.",
                ],
              ] as const
            ).map(([q, a], i) => (
              <div key={i} style={{ background: T.surface, padding: "14px 16px" }}>
                <div
                  style={{ fontFamily: T.fontHead, fontSize: 14, fontWeight: 500, letterSpacing: -0.2 }}
                >
                  {q}
                </div>
                <div style={{ fontSize: 12.5, color: T.text3, marginTop: 4, lineHeight: 1.55 }}>
                  {a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: pick(bp, { mobile: `28px ${padX}`, desktop: `40px ${padX}` }),
          borderTop: `1px solid ${T.outlineFaint}`,
          display: "flex",
          alignItems: pick(bp, { mobile: "stretch", desktop: "center" }),
          gap: pick(bp, { mobile: 14, desktop: 28 }),
          flexDirection: pick(bp, { mobile: "column", desktop: "row" }),
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{ fontFamily: T.fontHead, fontSize: 22, fontWeight: 500, letterSpacing: -0.3 }}
          >
            Still unsure which tier fits?
          </div>
          <div style={{ fontSize: 13, color: T.text3, marginTop: 4 }}>
            Start free. Upgrade the moment you hit a limit — no plan pressure.
          </div>
        </div>
        <Link
          href="/strategies"
          style={{
            fontFamily: T.fontHead,
            fontSize: 14,
            fontWeight: 600,
            padding: "12px 22px",
            borderRadius: 6,
            background: T.primary,
            color: T.surface,
            textAlign: "center",
          }}
        >
          Start free →
        </Link>
        <span
          style={{
            fontFamily: T.fontHead,
            fontSize: 14,
            fontWeight: 500,
            padding: "12px 18px",
            color: T.text2,
            cursor: "pointer",
            boxShadow: `inset 0 0 0 1px ${T.outlineFaint}`,
            borderRadius: 6,
            textAlign: "center",
          }}
        >
          Talk to us
        </span>
      </div>
      </main>
    </div>
  );
}

function BillingTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const T = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "7px 16px",
        borderRadius: 999,
        background: active ? T.surface : "transparent",
        color: active ? T.text : T.text3,
        boxShadow: active ? `0 0 0 1px ${T.outlineVariant}` : "none",
        fontWeight: active ? 600 : 400,
        fontFamily: "inherit",
        fontSize: "inherit",
        border: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
