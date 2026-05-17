import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme";
import { AuthSessionProvider } from "@/components/session-provider";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PSX Algos — Write strategies. Not code.",
  description:
    "Build trading strategies as a tree of conditions. Backtest on a decade of PSX data, deploy to signals, or spin up a paper-trading bot.",
  // Base favicon matches the site default (Paper). ThemeProvider updates the
  // SVG link at runtime to match the user's stored site-theme choice — see
  // components/theme.tsx. PNG fallbacks cover legacy browsers that don't
  // support SVG favicons.
  icons: {
    icon: [
      { url: "/icon-paper.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs synchronously before React hydrates so dark-mode users don't see a
// Paper → Amber flash on every load. Sets data-theme on <html> so the CSS
// cascade in globals.css picks the right token values before first paint.
// Keep the payload tiny — the script is inline and blocks first paint.
const themeInit = `(function(){try{var m=localStorage.getItem("psxalgos-theme");if(m==="dark"||m==="light"){document.documentElement.setAttribute("data-theme",m);}else if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.setAttribute("data-theme","dark");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <AuthSessionProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
