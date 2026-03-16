import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const ALLOWED_EMAIL = process.env.NEXTAUTH_ALLOWED_EMAIL ?? "";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      if (!ALLOWED_EMAIL) {
        console.error("[auth] NEXTAUTH_ALLOWED_EMAIL is not set — denying all logins");
        return false;
      }
      const allowed = profile?.email === ALLOWED_EMAIL;
      if (!allowed) {
        console.warn("[auth] Rejected login attempt from %s", profile?.email);
      }
      return allowed;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
