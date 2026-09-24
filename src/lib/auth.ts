import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { appUrl, vercelOrigins } from "@/lib/app-url";

export const auth = betterAuth({
  appName: "CottonTrace",
  baseURL: appUrl(),
  // Production, branch and preview deployment URLs on Vercel
  trustedOrigins: [appUrl(), ...vercelOrigins()],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  user: {
    additionalFields: {
      // Assigned during onboarding / by an admin — never accepted from the sign-up form.
      role: { type: "string", defaultValue: "PENDING", input: false },
      organizationId: { type: "string", required: false, input: false },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
