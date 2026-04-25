import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        // Google's stable providerAccountId, not a random UUID — existing
        // user rows in the cloud Neon DB key off this value.
        token.user_id = account.providerAccountId
        token.role = "authenticated"
      }
      return token
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.user_id as string,
          role: token.role as string,
        },
      }
    },
  },
  pages: { signIn: "/?auth=required" },
})
