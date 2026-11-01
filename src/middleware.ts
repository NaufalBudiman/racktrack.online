import NextAuth from "next-auth";
import authConfig from "./auth.config";

// Protects every /app route; unauthenticated users are sent to "/".
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/app/:path*"],
};
