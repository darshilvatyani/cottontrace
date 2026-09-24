import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const passport = await prisma.passport.findUnique({ where: { publicId } });
  if (!passport) return NextResponse.json({ error: "Unknown passport" }, { status: 404 });
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const dark = req.nextUrl.searchParams.get("dark") ?? "#1c1a16";
  const svg = await QRCode.toString(`${origin}/p/${publicId}`, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark, light: "#00000000" },
  });
  return new NextResponse(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" } });
}
