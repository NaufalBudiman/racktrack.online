import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe config (no DB adapter) — shared by middleware and the full auth setup.
// Google reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from the environment.
export default {
  providers: [
    Google({
      // Safe for Google: it only returns verified emails. Lets the seed script
      // pre-create the owner row before their first login.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: { signIn: "/" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
