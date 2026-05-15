"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AppFrame } from "@/components/frame";
import { useT, type Tokens } from "@/components/theme";
import { Btn, DotRow, EditorialHeader, Kicker, Ribbon } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { useBreakpoint, PAD, pick } from "@/components/responsive";
import type {
  StrategyCreateBody,
  StrategyCreateResponse,
  EntryRules,
  SingleCondition,
} from "@/lib/api/strategies";

type PresetKey =
  | "mean_reversion"
  | "momentum_breakout"
  | "golden_cross"
  | "bollinger_squeeze"
  | "macd_cross"
  | "blank";

type AfterKey = "editor" | "backtest";

interface Preset {
  key: PresetKey;
  glyph: string;
  tint: (T: Tokens) => string;
  name: string;
  desc: string;
  stats: string;
  popular?: boolean;
  type: string;
  baseRule: string;
  confirmation: string;
  defaultName: string;
  defaultId: string;
}

const PRESETS: Preset[] = [
  {
    key: "mean_reversion",
    glyph: "⟲",
    tint: (T) => T.primary,
    name: "Mean reversion",
    desc: "RSI oversold bounce with volume confirmation",
    stats: "+14.2% bt · 1.84 sharpe",
    popular: true,
    type: "Mean reversion",
    baseRule: "RSI(14) < 30",
    confirmation: "Volume > 1.5× avg",
    defaultName: "RSI Bounce v1",
    defaultId: "rsi_bounce_v1",
  },
  {
    key: "momentum_breakout",
    glyph: "↗",
    tint: (T) => T.gain,
    name: "Momentum breakout",
    desc: "Price breaks 20-day high on volume surge",
    stats: "+22.7% bt · 2.11 sharpe",
    type: "Momentum",
    baseRule: "Close > 20d high",
    confirmation: "Volume > 2× avg",
    defaultName: "Momentum Breakout",
    defaultId: "momentum_breakout",
  },
  {
    key: "golden_cross",
    glyph: "✕",
    tint: (T) => T.accent,
    name: "Golden cross",
    desc: "SMA(50) crosses above SMA(200), trend follow",
    stats: "+8.1% bt · 1.12 sharpe",
    type: "Trend follow",
    baseRule: "SMA(50) crosses SMA(200)",
    confirmation: "Price > SMA(50)",
    defaultName: "Golden Cross v1",
    defaultId: "golden_cross_v1",
  },
  {
    key: "bollinger_squeeze",
    glyph: "⬚",
    tint: (T) => T.primaryLight,
    name: "Bollinger squeeze",
    desc: "Volatility contraction then directional breakout",
    stats: "new · no backtest yet",
    type: "Volatility",
    baseRule: "BB width < 20d low",
    confirmation: "Break of outer band",
    defaultName: "Bollinger Squeeze",
    defaultId: "bollinger_squeeze",
  },
  {
    key: "macd_cross",
    glyph: "∿",
    tint: (T) => T.warning,
    name: "MACD cross",
    desc: "Classic 12/26/9 momentum trend filter",
    stats: "+6.4% bt · 0.92 sharpe",
    type: "Momentum",
    baseRule: "MACD(12,26) crosses signal",
    confirmation: "Histogram > 0",
    defaultName: "MACD Crossover",
    defaultId: "macd_crossover",
  },
  {
    key: "blank",
    glyph: "◯",
    tint: (T) => T.text2,
    name: "Blank canvas",
    desc: "Start from nothing and wire conditions yourself",
    stats: "for advanced users",
    type: "Custom",
    baseRule: "—",
    confirmation: "—",
    defaultName: "Untitled strategy",
    defaultId: "untitled",
  },
];

// Each preset maps to a minimal valid backend `StrategyCreate.entry_rules`.
// These are STARTER conditions — users are expected to refine them in the
// editor afterwards. Mismatches between the preset's `baseRule` text (which
// is human copy) and the actual condition we send are intentional: the copy
// describes the *spirit* of the preset, the conditions are the simplest
// possible realization the backend's indicator/operator vocabulary allows.
function presetToEntryRules(key: PresetKey): EntryRules {
  let conditions: SingleCondition[];
  switch (key) {
    case "mean_reversion":
      conditions = [
        { kind: "condition", indicator: "rsi", operator: "<", value: { type: "constant", value: 30 }, value_source: "30" },
      ];
      break;
    case "momentum_breakout":
      // Backend doesn't have a "20-day high" indicator — closest stand-in is
      // close > sma_20. Editor lets users tighten this once they're in.
      conditions = [
        { kind: "condition", indicator: "close_price", operator: ">", value: { type: "indicator", indicator: "sma_20" }, value_source: "sma_20" },
      ];
      break;
    case "golden_cross":
      conditions = [
        { kind: "condition", indicator: "sma_50", operator: "crosses_above", value: { type: "indicator", indicator: "sma_200" }, value_source: "sma_200" },
      ];
      break;
    case "bollinger_squeeze":
      conditions = [
        { kind: "condition", indicator: "close_price", operator: ">", value: { type: "indicator", indicator: "bb_upper" }, value_source: "bb_upper" },
      ];
      break;
    case "macd_cross":
      conditions = [
        { kind: "condition", indicator: "macd", operator: "crosses_above", value: { type: "indicator", indicator: "macd_signal" }, value_source: "macd_signal" },
      ];
      break;
    case "blank":
      // Truly blank: backend allows empty entry trees on DRAFT strategies
      // and only enforces "at least one leaf" at execution-path entries
      // (deploy / backtest / bot create+start / status→ACTIVE/PAUSED).
      // The user lands in the editor with a clean canvas.
      conditions = [];
      break;
  }
  return { conditions: { kind: "group", logic: "AND", conditions } };
}

// Slug preview only — the backend assigns the canonical strategy_id on create
// and returns it. We show this so the user has a sense of what the URL will
// look like; we don't send it.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "untitled";
}

// Post-B046 the strategy carries only what defines *the rules*. Universe
// and risk live on the bot/backtest/deploy request, not the strategy.
function buildCreateBody(preset: Preset, name: string, description: string): StrategyCreateBody {
  const trimmedName = name.trim() || preset.defaultName;
  const trimmedDesc = description.trim();
  return {
    name: trimmedName,
    description: trimmedDesc || `${preset.desc}.`,
    entry_rules: presetToEntryRules(preset.key),
    exit_rules: {},
  };
}

export default function WizardPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [presetKey, setPresetKey] = useState<PresetKey>("mean_reversion");
  const [afterKey, setAfterKey] = useState<AfterKey>("editor");
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const T = useT();
  const { bp, isMobile } = useBreakpoint();
  const padX = pick(bp, PAD.page);

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];
  const [name, setName] = useState<string>(preset.defaultName);
  const [description, setDescription] = useState<string>(`${preset.desc}.`);
  // Reset name/description whenever the user picks a different preset, so the
  // identity step starts from the new preset's defaults rather than stale text
  // from the previous one.
  useEffect(() => {
    setName(preset.defaultName);
    setDescription(`${preset.desc}.`);
  }, [preset.key, preset.defaultName, preset.desc]);

  async function onCreate() {
    setSubmitErr(null);
    const body = buildCreateBody(preset, name, description);
    let result: StrategyCreateResponse;
    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // 403 means user isn't on the `pro` plan — surface clearly.
        if (res.status === 403) {
          setSubmitErr("Creating strategies requires the Pro plan. Upgrade to continue.");
          return;
        }
        setSubmitErr(typeof err?.error === "string" ? err.error : `Create failed (${res.status})`);
        return;
      }
      result = (await res.json()) as StrategyCreateResponse;
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : "Network error");
      return;
    }
    const newId = result.strategy_id;
    const target = afterKey === "backtest"
      ? `/backtest/new?strategy_id=${newId}`
      : `/strategies/${newId}`;
    startTransition(() => router.push(target));
  }

  return (
    <AppFrame route="/strategies">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorialHeader
          kicker={
            <>
              <span style={{ color: T.primaryLight }}>Strategies</span> /{" "}
              <span style={{ color: T.text2 }}>new</span>
            </>
          }
          title={
            <>
              Name a{" "}
              <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>
                new strategy
              </span>
              .
            </>
          }
          meta={
            <>
              <span>Step {step} of 2</span>
              <span style={{ color: T.text3 }}>~1 minute</span>
              <span style={{ color: T.text3 }}>Esc to cancel</span>
            </>
          }
          actions={
            <Link href="/strategies" style={{ textDecoration: "none" }}>
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
              ["01", "Start from", "preset · blank · template"],
              ["02", "Ship it", "name · description · save"],
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
                    color: active ? T.primaryLight : done ? T.gain : T.text3,
                    letterSpacing: -0.5,
                  }}
                >
                  {n}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: T.fontHead,
                      fontSize: 14,
                      fontWeight: 500,
                      color: active ? T.text : T.text2,
                    }}
                  >
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
          }}
        >
          {step === 1 && <Step1 selected={presetKey} onSelect={setPresetKey} />}
          {step === 2 && (
            <Step2
              preset={preset}
              afterKey={afterKey}
              onAfter={setAfterKey}
              name={name}
              onName={setName}
              description={description}
              onDescription={setDescription}
            />
          )}
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
            {step === 1 && "Tip: start from a preset, you can always rewire it later."}
            {step === 2 && "A good name is short and describes the edge."}
          </span>
          <div style={{ flex: 1 }} />
          {step > 1 && (
            <Btn variant="ghost" size="md" onClick={() => setStep((s) => (s - 1) as 1 | 2)}>
              ← Back
            </Btn>
          )}
          {step < 2 && (
            <Btn variant="primary" size="md" onClick={() => setStep((s) => (s + 1) as 1 | 2)}>
              Continue →
            </Btn>
          )}
          {step === 2 && (
            <Btn
              variant="primary"
              size="md"
              icon={Icon.spark}
              onClick={() => {
                if (pending) return;
                void onCreate();
              }}
              style={pending ? { opacity: 0.6, cursor: "wait" } : undefined}
            >
              {pending
                ? "Creating…"
                : `Create & ${afterKey === "backtest" ? "run backtest" : "open editor"} →`}
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

function Step1({
  selected,
  onSelect,
}: {
  selected: PresetKey;
  onSelect: (k: PresetKey) => void;
}) {
  const T = useT();
  const { bp } = useBreakpoint();
  return (
    <div>
      <Kicker>starting point</Kicker>
      <h3
        style={{
          fontFamily: T.fontHead,
          fontSize: 24,
          fontWeight: 500,
          margin: "10px 0 24px",
          letterSpacing: -0.4,
        }}
      >
        Pick a preset or start blank.
      </h3>
      <div
        role="radiogroup"
        aria-label="Starting preset"
        style={{
          display: "grid",
          gridTemplateColumns: pick(bp, {
            mobile: "1fr",
            tablet: "1fr 1fr",
            desktop: "repeat(3, 1fr)",
          }),
          gap: 1,
          background: T.outlineFaint,
        }}
      >
        {PRESETS.map((p) => {
          const sel = p.key === selected;
          const tint = p.tint(T);
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => onSelect(p.key)}
              style={{
                background: sel ? T.surfaceLow : T.surface,
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                cursor: "pointer",
                minHeight: 180,
                outline: sel ? `2px solid ${T.primary}` : "none",
                outlineOffset: -2,
                border: "none",
                textAlign: "left",
                fontFamily: "inherit",
                color: "inherit",
                transition: "background 120ms ease",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: tint + "22",
                    color: tint,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: T.fontHead,
                    fontSize: 22,
                    fontWeight: 400,
                  }}
                >
                  {p.glyph}
                </span>
                {p.popular && !sel && (
                  <span
                    style={{
                      fontFamily: T.fontMono,
                      fontSize: 9.5,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: T.primaryLight + "22",
                      color: T.primaryLight,
                    }}
                  >
                    popular
                  </span>
                )}
                {sel && (
                  <span style={{ color: T.primary, fontFamily: T.fontMono, fontSize: 11 }}>
                    ● selected
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: T.fontHead,
                  fontSize: 17,
                  fontWeight: 500,
                  letterSpacing: -0.2,
                  marginTop: 6,
                  color: T.text,
                }}
              >
                {p.name}
              </div>
              <div style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.55, flex: 1 }}>{p.desc}</div>
              <div
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 10.5,
                  color: T.text3,
                  paddingTop: 8,
                  borderTop: `1px dotted ${T.outlineFaint}`,
                }}
              >
                {p.stats}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step2({
  preset,
  afterKey,
  onAfter,
  name,
  onName,
  description,
  onDescription,
}: {
  preset: Preset;
  afterKey: AfterKey;
  onAfter: (k: AfterKey) => void;
  name: string;
  onName: (v: string) => void;
  description: string;
  onDescription: (v: string) => void;
}) {
  const T = useT();
  const { bp } = useBreakpoint();
  const afterOpts: { key: AfterKey; title: string; desc: string }[] = [
    { key: "editor", title: "Open editor", desc: "Fine-tune rules and logic" },
    { key: "backtest", title: "Run backtest", desc: "Test on last 12 months" },
  ];
  const slug = slugify(name);
  const summaryName = name.trim() || preset.defaultName;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: pick(bp, {
          mobile: "1fr",
          tablet: "1.1fr 1fr",
          desktop: "1.1fr 1fr",
        }),
        gap: pick(bp, { mobile: 36, tablet: 40, desktop: 60 }),
      }}
    >
      <div>
        <Kicker>identity</Kicker>
        <h3
          style={{
            fontFamily: T.fontHead,
            fontSize: 24,
            fontWeight: 500,
            margin: "10px 0 24px",
            letterSpacing: -0.4,
          }}
        >
          Name it and save.
        </h3>

        <div>
          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 10.5,
              color: T.text3,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 8,
            }}
          >
            Name
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value.slice(0, 50))}
            maxLength={50}
            placeholder={preset.defaultName}
            aria-label="Strategy name"
            style={{
              width: "100%",
              fontFamily: T.fontHead,
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: -0.6,
              padding: "10px 0",
              border: "none",
              borderBottom: `2px solid ${T.primary}`,
              borderRadius: 0,
              background: "transparent",
              color: T.text,
              outline: "none",
              caretColor: T.primary,
            }}
          />
          <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.text3, marginTop: 6 }}>
            {name.length} / 50 · ID will be{" "}
            <span style={{ color: T.text2 }}>{slug}</span>
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
              marginBottom: 8,
            }}
          >
            Description{" "}
            <span style={{ color: T.text3, textTransform: "none", letterSpacing: 0 }}>
              (optional)
            </span>
          </div>
          <textarea
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            placeholder={`${preset.desc}. Universe and risk are picked when you deploy or backtest.`}
            aria-label="Strategy description"
            rows={3}
            style={{
              width: "100%",
              padding: "12px 14px",
              background: T.surfaceLow,
              borderRadius: 6,
              border: `1px solid ${T.outlineFaint}`,
              fontFamily: "inherit",
              fontSize: 13,
              lineHeight: 1.6,
              color: T.text,
              minHeight: 72,
              resize: "vertical",
              outline: "none",
              caretColor: T.primary,
            }}
          />
        </div>

        <div style={{ marginTop: 28 }}>
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
            After creating
          </div>
          <div
            role="radiogroup"
            aria-label="After creating"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            {afterOpts.map((opt) => {
              const sel = opt.key === afterKey;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => onAfter(opt.key)}
                  style={{
                    padding: 14,
                    background: sel ? T.surfaceLow : T.surface,
                    border: `1px solid ${sel ? T.primary : T.outlineFaint}`,
                    borderRadius: 6,
                    fontSize: 12.5,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        background: sel ? T.primary : "transparent",
                        boxShadow: `inset 0 0 0 1.5px ${sel ? T.primary : T.outline}`,
                      }}
                    />
                    <span style={{ fontFamily: T.fontHead, fontSize: 14, fontWeight: 500, color: T.text }}>
                      {opt.title}
                    </span>
                  </div>
                  <div
                    style={{ marginLeft: 22, color: T.text3, fontSize: 11.5, marginTop: 3 }}
                  >
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <Ribbon kicker="final summary" />
        <div style={{ marginTop: 14 }}>
          <DotRow label="Name" value={summaryName} bold />
          <DotRow label="Type" value={preset.type} />
          <DotRow label="Base rule" value={preset.baseRule} />
          <DotRow label="Confirmation" value={preset.confirmation} />
          <DotRow label="Status" value="Draft" color={T.text3} />
        </div>

        <div
          style={{
            marginTop: 18,
            padding: "10px 12px",
            background: T.surfaceLow,
            border: `1px dashed ${T.outlineFaint}`,
            borderRadius: 6,
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.text3,
            lineHeight: 1.55,
          }}
        >
          Universe and risk guardrails are picked at <span style={{ color: T.text2 }}>deploy</span>,{" "}
          <span style={{ color: T.text2 }}>backtest</span>, or <span style={{ color: T.text2 }}>bot</span>{" "}
          time — not on the strategy itself.
        </div>

        <div style={{ marginTop: 28 }}>
          <Ribbon kicker="outputs available after save" color={T.deploy} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
            {(
              [
                ["⎈", T.primary, "Backtest"],
                ["◉", T.deploy, "Signals"],
                ["◇", T.accent, "Bot"],
              ] as const
            ).map(([g, c, t]) => (
              <div
                key={t}
                style={{
                  padding: 12,
                  background: T.surface,
                  border: `1px solid ${T.outlineFaint}`,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: c + "22",
                    color: c,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: T.fontHead,
                    fontSize: 14,
                  }}
                >
                  {g}
                </span>
                <span style={{ fontFamily: T.fontHead, fontSize: 13, fontWeight: 500, color: T.text }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
