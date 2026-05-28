"use client";

import { useState } from "react";
import { MarketingNav, SkipLink } from "@/components/frame";
import { useT } from "@/components/theme";
import { useBreakpoint, PAD, pick, clampPx } from "@/components/responsive";

const CHANNELS: ReadonlyArray<{
  label: string;
  value: string;
  href: string;
  meta: string;
  for: string;
}> = [
  {
    label: "Product help, bug reports, feedback",
    value: "support@psxalgos.com",
    href: "mailto:support@psxalgos.com",
    meta: "Fastest reply path. Reaches me directly.",
    for: "support",
  },
  {
    label: "General inquiries, partnerships, press",
    value: "info@psxalgos.com",
    href: "mailto:info@psxalgos.com",
    meta: "Anything not strictly product-related.",
    for: "info",
  },
  {
    label: "WhatsApp / phone",
    value: "+92 334 2153065",
    href: "https://wa.me/923342153065",
    meta: "Tap to chat on WhatsApp — fastest for quick back-and-forth.",
    for: "phone",
  },
];

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export default function ContactPage() {
  const T = useT();
  const { bp } = useBreakpoint();
  const padX = pick(bp, PAD.pageMarketing);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot — must stay empty. If a bot fills it, the API silently drops
  // the request. Hidden via inline styles so screen readers ignore it.
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "sending") return;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus({
          kind: "error",
          message:
            data.error ||
            "Couldn't send your message. Please email support@psxalgos.com directly.",
        });
        return;
      }
      setStatus({ kind: "success" });
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus({
        kind: "error",
        message:
          "Network error while sending. Please email support@psxalgos.com directly.",
      });
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: T.surface2,
    border: `1px solid ${T.outlineFaint}`,
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 14,
    color: T.text,
    fontFamily: T.fontSans,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: T.fontMono,
    fontSize: 11,
    color: T.text3,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  };

  const sending = status.kind === "sending";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: T.surface,
        color: T.text,
        fontFamily: T.fontSans,
      }}
    >
      <SkipLink />
      <MarketingNav badge="contact" />

      <main
        id="main-content"
        style={{
          padding: pick(bp, {
            mobile: `40px ${padX} 80px`,
            desktop: `72px ${padX} 120px`,
          }),
          maxWidth: 880,
          margin: "0 auto",
        }}
      >
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
          ── get in touch
        </div>
        <h1
          style={{
            fontFamily: T.fontHead,
            fontSize: clampPx(36, 7, 56),
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            margin: "0 0 18px",
            color: T.text,
          }}
        >
          Send feedback.{" "}
          <span style={{ fontStyle: "italic", color: T.primaryLight, fontWeight: 400 }}>
            Or just say hi.
          </span>
        </h1>
        <p
          style={{
            fontSize: pick(bp, { mobile: 15, desktop: 16.5 }),
            color: T.text2,
            lineHeight: 1.6,
            margin: "0 0 36px",
            maxWidth: 620,
          }}
        >
          PSX Algos is being built and maintained by one person. Every message gets read —
          bug reports, half-formed feature ideas, strategy questions, broker integration
          requests, complaints about the colour scheme. All of it.
        </p>

        {/* Contact form */}
        <form
          onSubmit={onSubmit}
          style={{
            background: T.surfaceLow,
            border: `1px solid ${T.outlineFaint}`,
            borderRadius: 12,
            padding: pick(bp, { mobile: 20, desktop: 28 }),
            marginBottom: 48,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: pick(bp, { mobile: "1fr", desktop: "1fr 1fr" }), gap: 16 }}>
            <div>
              <label htmlFor="contact-name" style={labelStyle}>Your name</label>
              <input
                id="contact-name"
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={sending}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="contact-email" style={labelStyle}>Email</label>
              <input
                id="contact-email"
                type="email"
                required
                maxLength={200}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label htmlFor="contact-subject" style={labelStyle}>Subject (optional)</label>
            <input
              id="contact-subject"
              type="text"
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
              style={inputStyle}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <label htmlFor="contact-message" style={labelStyle}>Message</label>
            <textarea
              id="contact-message"
              required
              minLength={10}
              maxLength={5000}
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
              style={{ ...inputStyle, resize: "vertical", minHeight: 140, fontFamily: T.fontSans }}
              placeholder="Bug report? Feature idea? Strategy question? Anything."
            />
          </div>

          {/* Honeypot — hidden from humans, bots fill it and get silently dropped */}
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}
          >
            <label htmlFor="contact-website">Website</label>
            <input
              id="contact-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div
            style={{
              marginTop: 20,
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              disabled={sending}
              style={{
                fontFamily: T.fontHead,
                fontSize: 14,
                fontWeight: 600,
                padding: "12px 22px",
                borderRadius: 6,
                background: sending ? T.outline : T.primary,
                color: T.surface,
                border: "none",
                cursor: sending ? "wait" : "pointer",
                opacity: sending ? 0.8 : 1,
              }}
            >
              {sending ? "Sending…" : "Send message →"}
            </button>
            {status.kind === "success" && (
              <span style={{ color: T.gain, fontSize: 13, fontFamily: T.fontMono }}>
                ✓ Sent. I'll get back to you.
              </span>
            )}
            {status.kind === "error" && (
              <span style={{ color: T.loss, fontSize: 13, fontFamily: T.fontMono }}>
                {status.message}
              </span>
            )}
          </div>
        </form>

        {/* Direct channels as backup */}
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.text3,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          ── or reach me directly
        </div>
        <div
          style={{
            display: "grid",
            gap: 1,
            background: T.outlineFaint,
            border: `1px solid ${T.outlineFaint}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {CHANNELS.map((ch) => (
            <a
              key={ch.for}
              href={ch.href}
              target={ch.href.startsWith("http") ? "_blank" : undefined}
              rel={ch.href.startsWith("http") ? "noopener noreferrer" : undefined}
              style={{
                display: "block",
                background: T.surface,
                padding: pick(bp, { mobile: "18px 20px", desktop: "22px 26px" }),
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 10.5,
                  color: T.text3,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                {ch.label}
              </div>
              <div
                style={{
                  fontFamily: T.fontHead,
                  fontSize: pick(bp, { mobile: 18, desktop: 22 }),
                  fontWeight: 500,
                  letterSpacing: -0.3,
                  color: T.primaryLight,
                  wordBreak: "break-all",
                }}
              >
                {ch.value}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: T.text3,
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                {ch.meta}
              </div>
            </a>
          ))}
        </div>

        <div
          style={{
            marginTop: 32,
            padding: pick(bp, { mobile: 18, desktop: 22 }),
            background: T.surfaceLow,
            borderRadius: 10,
            border: `1px solid ${T.outlineFaint}`,
            fontSize: 13.5,
            color: T.text2,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: T.text, fontWeight: 600 }}>One ask:</strong> if you're
          reporting a bug, include the page URL and what you were trying to do. If you're
          suggesting a feature, tell me what problem you're trying to solve — that's almost
          always more useful than the feature itself.
        </div>
      </main>
    </div>
  );
}
