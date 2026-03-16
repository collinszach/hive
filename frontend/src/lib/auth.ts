import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          const res = await fetch(`${BACKEND_URL}/api/auth-internal/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${INTERNAL_API_TOKEN}`,
            },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const user = await res.json();
          return { id: user.id, name: user.username };
        } catch (err) {
          console.error("[auth] verify request failed:", err);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
