"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

// Thin client wrapper so the server-rendered RootLayout can mount NextAuth's
// SessionProvider without becoming a client component itself. useSession()
// reads from this context.
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
