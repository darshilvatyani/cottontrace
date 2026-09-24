import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { seedDemo } from "@/lib/demo-seed";

// Seeding runs ~70 contract invocations; give it room on Vercel.
export const maxDuration = 300;

/** GET — is the demo data loaded? */
export async function GET() {
  const [organizations, blocks] = await Promise.all([prisma.organization.count(), prisma.block.count()]);
  return NextResponse.json({ seeded: organizations > 0, organizations, blocks });
}

/**
 * POST — load the demo dataset.
 * Allowed without credentials only while the database is empty (first deploy).
 * Re-seeding a populated database wipes it, so it requires `x-setup-secret: <BETTER_AUTH_SECRET>`.
 */
export async function POST(req: NextRequest) {
  const populated = (await prisma.organization.count()) > 0;
  if (populated) {
    const secret = process.env.BETTER_AUTH_SECRET ?? "";
    const given = req.headers.get("x-setup-secret") ?? "";
    const ok = secret.length > 0 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
    if (!ok) return NextResponse.json({ error: "Database already contains data. Send x-setup-secret to re-seed." }, { status: 409 });
  }
  const lines: string[] = [];
  const result = await seedDemo((m) => lines.push(m));
  return NextResponse.json({ ok: true, ...result, log: lines });
}
