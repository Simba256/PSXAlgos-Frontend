"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AppFrame } from "@/components/frame";
import { useT } from "@/components/theme";
import { Btn, DotRow, EditorialHeader, Kicker, Ribbon } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick } from "@/components/responsive";
import type { BotResponse } from "@/lib/api/bots";

export default function BotWizardPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // strategyId is read from ?strategy_id=… on mount. Reading via
  // window.location instead of useSearchParams keeps the page out of the
  // Next 16 CSR-bailout error if it ever ends up prerendered.
  const [strategyId, setStrategyId] = useState<number | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URL(window.location.href).searchParams.get("strategy_id");
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) setStrategyId(n);
  }, []);

  async function onLaunch() {
    setSubmitErr(null);
    if (!strategyId) {
      setSubmitErr("Open a strategy and use 'Spin up bot' to bind one.");
      return;
    }
    let bot: BotResponse;
    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy_id: strategyId,
          // Wizard shows hardcoded values for the alpha. Real edits land in
          // the dashboard when the bot is paused.
          name: "Bot " + new Date().toISOString().slice(0, 10),
          allocated_capital: 1_000_000,
          max_positions: 5,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setSubmitErr("Creating bots requires the Pro+ plan. Upgrade to continue.");
          return;
        }
        setSubmitErr(typeof err?.error === "string" ? err.error : `Create failed (${res.status})`);
        return;
      }
      bot = (await res.json()) as BotResponse;
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : "Network error");
      return;
    }
    startTransition(() => router.push(`/bots/${bot.id}`));
  }
  return (
    <AppFrame route="/bots">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorialHeader
          kicker={
            <>
              <Link href="/strategies" style={{ color: T.primaryLight }}>
                Strategies
              </Link>{" "}
              / Momentum Breakout / <span style={{ color: T.text2 }}>bind bot</span>
            </>
          }
          title={
            <>
              Spin up a{" "}
              <span style={{ fontStyle: "italic", color: T.accent, fontWeight: 400 }}>bot</span>.
            </>
          }
          meta={
            <>
              <span>Step {step} of 3</span>
              <span>
                Bound to <span style={{ color: T.primaryLight }}>Momentum Breakout</span>
              </span>
              <span style={{ color: T.text3 }}>paper-trading only</span>
            </>
          }
          actions={
            <Link href="/bots" style={{ textDecoration: "none" }}>
              <Btn variant="ghost" size="sm">
                Cancel
              </Btn>
            </Link>
          }
        />

        <div
          style={{
            padding: `14px ${padX}`,
            borderBottom: `1px solid ${T.outlineFaint}`,
            display: "flex",
            alignItems: isMobile ? "stretch" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 10 : 0,
          }}
        >
          {(
            [
              ["01", "Capital", "starting balance"],
              ["02", "Sizing", "how much per trade"],
              ["03", "Safety rails", "when to halt"],
            ] as const
          ).map(([n, t, d], i) => {
            const active = i + 1 === step;
            const done = i + 1 < step;
            return (
              <div
                key={n}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: active || done ? 1 : 0.45,
                }}
              >
                <span
                  style={{
                    fontFamily: T.fontHead,
                    fontSize: 28,
                    fontWeight: 300,
                    fontStyle: "italic",
                    color: active ? T.accent : done ? T.gain : T.text3,
                  }}
                >
                  {n}
                </span>
                <div>
                  <div style={{ fontFamily: T.fontHead, fontSize: 14, fontWeight: 500 }}>
                    {t}{" "}
                    {done && (
                      <span style={{ color: T.gain, fontSize: 11, marginLeft: 6 }}>✓</span>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: T.fontMono,
                      fontSize: 10,
                      color: T.text3,
                      textTransform: "uppercase",
                      letterSpacing: 0.7,
                      marginTop: 3,
                    }}
                  >
                    {d}
                  </div>
                </div>
                {i < 2 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: done ? T.gain + "66" : T.outlineFaint,
                      marginLeft: 20,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: pick(bp, {
              mobile: `24px ${padX} 28px`,
              desktop: `36px ${padX} 40px`,
            }),
            display: "grid",
            gridTemplateColumns: pick(bp, {
              mobile: "minmax(0, 1fr)",
              tablet: "minmax(0, 1fr)",
              desktop: "minmax(0, 1.1fr) minmax(0, 1fr)",
            }),
            gap: pick(bp, { mobile: 28, desktop: 60 }),
          }}
        >
          <div>
            {step === 1 && <Step1 />}
            {step === 2 && <Step2 />}
            {step === 3 && <Step3 />}
          </div>
          <Preview step={step} />
        </div>

        <div
          style={{
            padding: `14px ${padX}`,
            borderTop: `1px solid ${T.outlineFaint}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3 }}>
            Paper-trading · no real broker connected
          </span>
          <div style={{ flex: 1 }} />
          {step > 1 && (
            <Btn variant="ghost" size="md" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
              ← Back
            </Btn>
          )}
          {step < 3 && (
            <Btn variant="primary" size="md" onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>
              Continue →
            </Btn>
          )}
          {step === 3 && (
            <Btn
              variant="deploy"
              size="md"
              icon={Icon.spark}
              onClick={() => {
                if (pending) return;
                void onLaunch();
              }}
              style={pending ? { opacity: 0.6, cursor: "wait" } : undefined}
            >
              {pending ? "Launching…" : "Launch bot →"}
            </Btn>
          )}
        </div>
        {submitErr && (
          <div
            role="alert"
            style={{
              padding: `10px ${padX}`,
              borderTop: `1px solid ${T.outlineFaint}`,
              background: T.surfaceLow,
              fontFamily: T.fontMono,
              fontSize: 12,
              color: T.loss,
            }}
          >
            {submitErr}
          </div>
        )}
      </div>
    </AppFrame>
  );
}

function Step1() {
  const T = useT();
  return (
    <>
      <Kicker>starting capital</Kicker>
      <h3
        style={{
          fontFamily: T.fontHead,
          fontSize: 24,
          fontWeight: 500,
          margin: "10px 0 24px",
          letterSpacing: -0.4,
        }}
      >
        How much paper money does this bot start with?
      </h3>
      <div
        style={{
          fontFamily: T.fontHead,
          fontSize: "clamp(40px, 10vw, 64px)",
          fontWeight: 500,
          letterSpacing: -1.4,
          color: T.text,
          lineHeight: 1.05,
        }}
      >
        <span
          style={{
            color: T.text3,
            fontSize: "clamp(18px, 4.5vw, 28px)",
            marginRight: 10,
          }}
        >
          PKR
        </span>
        1,000,000
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["100K", "500K", "1M", "5M", "10M"] as const).map((p, i) => (
          <span
            key={p}
            style={{
              fontFamily: T.fontMono,
              fontSize: 11,
              padding: "6px 14px",
              borderRadius: 999,
              background: i === 2 ? T.primary : "transparent",
              color: i === 2 ? "#fff" : T.text2,
              boxShadow: `0 0 0 1px ${i === 2 ? T.primary : T.outlineFaint}`,
            }}
          >
            {p}
          </span>
        ))}
      </div>
      <div
        style={{
          marginTop: 32,
          padding: 14,
          background: T.surfaceLow,
          borderRadius: 6,
          fontSize: 12.5,
          color: T.text3,
          lineHeight: 1.6,
        }}
      >
        This is paper money. No real broker is connected. The bot simulates a portfolio so you can
        see how the strategy would have performed.
      </div>
    </>
  );
}

function Step2() {
  const T = useT();
  return (
    <>
      <Kicker>position sizing</Kicker>
      <h3
        style={{
          fontFamily: T.fontHead,
          fontSize: 24,
          fontWeight: 500,
          margin: "10px 0 24px",
          letterSpacing: -0.4,
        }}
      >
        How big is each trade?
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18 }}>
        <div>
          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 10.5,
              color: T.text3,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 6,
            }}
          >
            Position size
          </div>
          <div style={{ fontFamily: T.fontHead, fontSize: 38, fontWeight: 500 }}>2.0%</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3, marginTop: 4 }}>
            ≈ PKR 20,000 per trade
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 10.5,
              color: T.text3,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 6,
            }}
          >
            Max concurrent
          </div>
          <div style={{ fontFamily: T.fontHead, fontSize: 38, fontWeight: 500 }}>
            5 <span style={{ fontSize: 16, color: T.text3 }}>positions</span>
          </div>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.text3, marginTop: 4 }}>
            max 10% exposure
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 10.5,
            color: T.text3,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 10,
          }}
        >
          Sizing method
        </div>
        {(
          [
            ["Fixed %", "Always 2% of current equity", true],
            ["Kelly", "Scale by historical edge", false],
            ["Fixed PKR", "Always PKR 20,000 per trade", false],
          ] as const
        ).map(([n, d, sel]) => (
          <div
            key={n}
            style={{
              padding: "12px 14px",
              background: sel ? T.surfaceLow : "transparent",
              borderTop: `1px solid ${T.outlineFaint}`,
              display: "grid",
              gridTemplateColumns: "20px 1fr",
              gap: 12,
              alignItems: "center",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: sel ? T.primary : "transparent",
                boxShadow: `inset 0 0 0 1.5px ${sel ? T.primary : T.outline}`,
              }}
            />
            <div>
              <div style={{ fontFamily: T.fontHead, fontSize: 13.5, fontWeight: 500 }}>{n}</div>
              <div style={{ fontSize: 11.5, color: T.text3, marginTop: 2 }}>{d}</div>
            </div>
          </div>
        ))}
        <div style={{ height: 1, background: T.outlineFaint }} />
      </div>
    </>
  );
}

function Step3() {
  const T = useT();
  return (
    <>
      <Kicker color={T.warning}>safety rails</Kicker>
      <h3
        style={{
          fontFamily: T.fontHead,
          fontSize: 24,
          fontWeight: 500,
          margin: "10px 0 8px",
          letterSpacing: -0.4,
        }}
      >
        When should the bot stop itself?
      </h3>
      <p style={{ fontSize: 13, color: T.text3, lineHeight: 1.55, marginBottom: 20, maxWidth: 480 }}>
        These are hard caps. Crossing one pauses or halts the bot — you&apos;ll get a notification
        and can restart after review.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16 }}>
        {(
          [
            ["Max drawdown", "−15%", T.loss, "Pause bot if equity drops 15% from peak"],
            ["Daily loss cap", "−3%", T.loss, "Halt for the day, resume tomorrow"],
            ["Trading window", "10:00–15:15", T.text2, "PSX market hours, PKT"],
            ["Kill-switch", "On", T.gain, "One-tap stop-all from dashboard"],
          ] as const
        ).map(([l, v, c, d]) => (
          <div
            key={l}
            style={{
              padding: 16,
              background: T.surfaceLow,
              borderRadius: 6,
              border: `1px solid ${T.outlineFaint}`,
            }}
          >
            <div
              style={{
                fontFamily: T.fontMono,
                fontSize: 10.5,
                color: T.text3,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              {l}
            </div>
            <div
              style={{
                fontFamily: T.fontHead,
                fontSize: 26,
                fontWeight: 500,
                color: c,
                marginTop: 4,
              }}
            >
              {v}
            </div>
            <div style={{ fontSize: 11.5, color: T.text3, marginTop: 6, lineHeight: 1.4 }}>{d}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function Preview({ step }: { step: 1 | 2 | 3 }) {
  const T = useT();
  return (
    <div>
      <Ribbon kicker="preview · your bot" />
      <div style={{ marginTop: 14 }}>
        <DotRow label="Name" value="Momentum · live" bold />
        <DotRow label="Strategy" value="Momentum Breakout" color={T.primaryLight} />
        <DotRow label="Starting capital" value="PKR 1,000,000" />
        <DotRow label="Position size" value="2% fixed" />
        <DotRow label="Max concurrent" value="5 positions" />
        <DotRow label="Max drawdown" value="−15%" color={step >= 3 ? T.loss : T.text3} />
        <DotRow label="Daily loss cap" value="−3%" color={step >= 3 ? T.loss : T.text3} />
        <DotRow
          label="Trading window"
          value={step >= 3 ? "10:00–15:15 PKT" : "—"}
          color={step >= 3 ? T.text2 : T.text3}
        />
      </div>
      {step === 3 && (
        <div
          style={{
            marginTop: 28,
            padding: 16,
            background: T.deploy + "11",
            borderRadius: 6,
            border: `1px solid ${T.deploy}55`,
          }}
        >
          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 10.5,
              color: T.deploy,
              letterSpacing: 0.7,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Ready to launch
          </div>
          <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.55 }}>
            Bot will start on the next market open. You can pause at any time from the dashboard.
          </div>
        </div>
      )}
    </div>
  );
}
