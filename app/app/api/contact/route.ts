// Public contact-form sender. Receives a form POST from /contact, validates
// it, and forwards via Resend to support@psxalgos.com.
//
// Honeypot: the `website` field must be empty. Bots fill every input they
// see; humans don't see the field (display:none). Catches the bulk of
// drive-by spam without inflicting a CAPTCHA on real visitors.
//
// Env:
//   RESEND_API_KEY   — required, from resend.com dashboard
//   CONTACT_TO       — optional, defaults to support@psxalgos.com
//   CONTACT_FROM     — optional, defaults to "PSX Algos <onboarding@resend.dev>".
//                      Switch to noreply@psxalgos.com once the domain is
//                      verified in Resend (DNS records added).

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const TO_DEFAULT = "support@psxalgos.com";
const FROM_DEFAULT = "PSX Algos <onboarding@resend.dev>";

const MAX_NAME = 100;
const MAX_EMAIL = 200;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;
const MIN_MESSAGE = 10;

// Conservative RFC 5322 subset — good enough to catch typos without
// rejecting real addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  website?: unknown; // honeypot
};

function asString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Misconfiguration — log on the server, return a generic message so
    // visitors get a fallback path instead of a leaked internal state.
    console.error("[contact] RESEND_API_KEY is not set");
    return NextResponse.json(
      { error: "Email service is not configured. Please email support@psxalgos.com directly." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Honeypot: bots fill every input. If `website` has content the request
  // is almost certainly a bot. Return 200 OK so the bot thinks it succeeded
  // and doesn't escalate — but don't actually send.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = asString(body.name, MAX_NAME);
  const email = asString(body.email, MAX_EMAIL);
  const subjectRaw = asString(body.subject, MAX_SUBJECT);
  const message = asString(body.message, MAX_MESSAGE);

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!message || message.length < MIN_MESSAGE) {
    return NextResponse.json(
      { error: `Message must be at least ${MIN_MESSAGE} characters.` },
      { status: 400 },
    );
  }

  const to = process.env.CONTACT_TO || TO_DEFAULT;
  const from = process.env.CONTACT_FROM || FROM_DEFAULT;
  const subject = subjectRaw ? `[Contact] ${subjectRaw}` : `[Contact] New message from ${name}`;

  const text = [
    `From: ${name} <${email}>`,
    subjectRaw ? `Subject: ${subjectRaw}` : null,
    "",
    message,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px;">
      <p style="margin:0 0 12px;color:#555;font-size:13px;">
        New message from the PSX Algos contact form.
      </p>
      <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <tr><td style="padding:4px 12px 4px 0;color:#888;">From</td><td>${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td></tr>
        ${subjectRaw ? `<tr><td style="padding:4px 12px 4px 0;color:#888;">Subject</td><td>${escapeHtml(subjectRaw)}</td></tr>` : ""}
      </table>
      <div style="white-space:pre-wrap;font-size:14.5px;line-height:1.6;border-left:3px solid #2e8a5f;padding-left:14px;">${escapeHtml(message)}</div>
    </div>
  `;

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: [to],
      replyTo: email,
      subject,
      text,
      html,
    });

    if (result.error) {
      console.error("[contact] Resend error:", result.error);
      return NextResponse.json(
        { error: "Couldn't send your message. Please email support@psxalgos.com directly." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] send failed:", err);
    return NextResponse.json(
      { error: "Couldn't send your message. Please email support@psxalgos.com directly." },
      { status: 502 },
    );
  }
}
