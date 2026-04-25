#!/usr/bin/env node
// Fails the build if any NEXT_PUBLIC_* identifier contains a sensitive-looking
// token. Next.js inlines every NEXT_PUBLIC_* into the client bundle — a
// NEXT_PUBLIC_*_SECRET / KEY / TOKEN is an irreversibly leaked secret the
// moment the build ships.
//
// See PRE_AUTH_DECISIONS.md § ADR-4. Intentionally deps-free: the project
// deliberately ships 3 runtime deps and no linter. Invoked via `prebuild`
// in package.json.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Case-insensitive. Any NEXT_PUBLIC_ name containing these substrings is
// treated as a leak candidate unless explicitly allowlisted below.
const DANGER_SUBSTRINGS = [
  "SECRET",
  "TOKEN",
  "PASSWORD",
  "PRIVATE",
  "CREDENTIAL",
  // "KEY" handled separately — many legitimate public keys end in _KEY
  //  (e.g. Stripe publishable, reCAPTCHA site). Allowlist by exact name.
];

// Exact NEXT_PUBLIC_ names permitted even if they match a danger substring.
// Add one entry here when intentionally exposing a public identifier.
const ALLOWLIST = new Set([
  // e.g. "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
]);

// Flag NEXT_PUBLIC_*_KEY only when it ALSO contains a known-private hint.
// Legitimate public *_KEY names (publishable key, site key) pass through.
const KEY_DANGER_HINTS = ["PRIVATE", "SECRET", "API_KEY", "SERVICE_KEY", "ADMIN_KEY"];

const NEXT_PUBLIC_PATTERN = /NEXT_PUBLIC_[A-Z0-9_]+/g;

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "out",
  "dist",
  "coverage",
  ".turbo",
  ".vercel",
  "scripts", // don't scan this script itself for its own literal patterns
]);

const SCANNED_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && !entry.name.startsWith(".env")) {
      // Skip dotfiles except .env*
      if (IGNORED_DIRS.has(entry.name)) continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      const isEnv = entry.name === ".env" || entry.name.startsWith(".env.");
      const ext = path.extname(entry.name);
      if (isEnv || SCANNED_EXTS.has(ext)) {
        yield { full, isEnv };
      }
    }
  }
}

function isDangerous(name) {
  if (ALLOWLIST.has(name)) return false;
  const upper = name.toUpperCase();
  for (const sub of DANGER_SUBSTRINGS) {
    if (upper.includes(sub)) return true;
  }
  if (upper.endsWith("_KEY") || upper.includes("_KEY_")) {
    for (const hint of KEY_DANGER_HINTS) {
      if (upper.includes(hint)) return true;
    }
  }
  return false;
}

async function main() {
  const offenders = new Map(); // name -> Set<filepath>
  const skipSelf = path.resolve(__dirname, "check-env.mjs");

  try {
    await stat(ROOT);
  } catch {
    console.error(`check-env: root ${ROOT} not accessible`);
    process.exit(1);
  }

  for await (const { full, isEnv } of walk(ROOT)) {
    if (full === skipSelf) continue;
    let text;
    try {
      text = await readFile(full, "utf8");
    } catch {
      continue;
    }

    if (isEnv) {
      // .env files: parse line-by-line, flag assignments.
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const m = line.match(/^(NEXT_PUBLIC_[A-Z0-9_]+)\s*=/);
        if (m && isDangerous(m[1])) {
          if (!offenders.has(m[1])) offenders.set(m[1], new Set());
          offenders.get(m[1]).add(path.relative(ROOT, full));
        }
      }
    } else {
      // Source files: grep any reference.
      const matches = text.match(NEXT_PUBLIC_PATTERN);
      if (!matches) continue;
      for (const name of matches) {
        if (!isDangerous(name)) continue;
        if (!offenders.has(name)) offenders.set(name, new Set());
        offenders.get(name).add(path.relative(ROOT, full));
      }
    }
  }

  if (offenders.size === 0) {
    console.log("check-env: OK — no NEXT_PUBLIC_* names look sensitive.");
    return;
  }

  console.error("\ncheck-env: FAIL\n");
  console.error(
    "Found NEXT_PUBLIC_* identifiers that look like secrets. Next.js inlines",
  );
  console.error("these into the client bundle — they will be published.\n");
  for (const [name, files] of offenders) {
    console.error(`  ${name}`);
    for (const f of files) console.error(`    → ${f}`);
  }
  console.error(
    "\nFix: drop the NEXT_PUBLIC_ prefix (server-only), or, if the value is",
  );
  console.error(
    "truly safe to publish, allowlist it by exact name in scripts/check-env.mjs.",
  );
  console.error("See PRE_AUTH_DECISIONS.md § ADR-4.\n");
  process.exit(1);
}

main().catch((err) => {
  console.error("check-env: crashed", err);
  process.exit(1);
});
