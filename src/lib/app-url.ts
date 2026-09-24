/** Public base URL: explicit env first, then Vercel's system variables, then localhost. */
export function vercelOrigins() {
  return [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]
    .filter((h): h is string => !!h)
    .map((h) => `https://${h}`);
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? vercelOrigins()[0] ?? "http://localhost:3000";
}
