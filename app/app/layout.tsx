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
  metadataBase: new URL("https://psxalgos.com"),
  title: "PSX Algos — Write strategies. Not code.",
  description:
    "Build trading strategies as a tree of conditions. Backtest on a decade of PSX data, deploy to signals, or spin up a paper-trading bot.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "PSX Algos",
    title: "PSX Algos — Write strategies. Not code.",
    description:
      "Visual strategy builder, backtester, and paper-trading bots for the Pakistan Stock Exchange. Free.",
    url: "https://psxalgos.com",
    locale: "en_PK",
  },
  twitter: {
    card: "summary_large_image",
    title: "PSX Algos — Write strategies. Not code.",
    description:
      "Visual strategy builder, backtester, and paper-trading bots for the Pakistan Stock Exchange. Free.",
  },
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

// Runs synchronously before React hydrates so first paint matches the
// user's chosen site theme. Paper is the default for everyone; we no longer
// follow OS prefers-color-scheme — too many users on dark-mode phones were
// landing on Amber without realising there was a Paper option. Anyone who
// wants Amber clicks the toggle once and localStorage pins it forever.
const themeInit = `(function(){try{var m=localStorage.getItem("psxalgos-theme");if(m==="dark"||m==="light"){document.documentElement.setAttribute("data-theme",m);}else{document.documentElement.setAttribute("data-theme","light");}}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

// Organization + WebSite JSON-LD. Applied site-wide so any page an LLM or
// search engine fetches has structured identity for the publisher and the
// site. WebApplication-specific schema lives on the home page (app/page.tsx)
// where the product description is most appropriate.
const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://psxalgos.com/#organization",
      name: "PSX Algos",
      url: "https://psxalgos.com",
      logo: "https://psxalgos.com/icon-512.png",
      email: "support@psxalgos.com",
      description:
        "Free trading-strategy platform for the Pakistan Stock Exchange (PSX). Visual strategy builder, backtesting, signal feeds, and paper-trading bots.",
      areaServed: { "@type": "Country", name: "Pakistan" },
      knowsAbout: [
        "Pakistan Stock Exchange",
        "PSX",
        "KSE-100",
        "KSE-30",
        "KMI-30",
        "Algorithmic Trading",
        "Technical Analysis",
        "Backtesting",
        "Paper Trading",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://psxalgos.com/#website",
      url: "https://psxalgos.com",
      name: "PSX Algos",
      publisher: { "@id": "https://psxalgos.com/#organization" },
      inLanguage: "en",
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
        <AuthSessionProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
