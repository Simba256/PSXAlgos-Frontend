import type { NextConfig } from "next";
import path from "node:path";

// Conservative always-safe headers. CSP deliberately omitted until auth lands
// — a real CSP needs allow-listing for Google OAuth / font CDN and locking one
// in now would block that work. Revisit with P2-1 (OAuth architecture).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Tunnel wildcards only in development. Static at build-time either way, but
  // leaving them empty in prod makes the intent explicit and prevents drift if
  // Next's semantics ever extend beyond dev.
  allowedDevOrigins: isDev
    ? ["*.ngrok-free.app", "*.ngrok.io", "*.ngrok.app", "*.trycloudflare.com"]
    : [],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
