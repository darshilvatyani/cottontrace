import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStored } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const bytes = await readStored(doc.storagePath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": doc.mimeType,
        "content-disposition": `inline; filename="${doc.name.replace(/"/g, "")}"`,
        "x-anchored-sha256": doc.sha256,
      },
    });
  } catch {
    return NextResponse.json({ error: "Stored file is missing" }, { status: 410 });
  }
}
