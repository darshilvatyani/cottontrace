import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/stage-icon";
import { Scanner } from "./scanner";

export const metadata = { title: "Scan a passport" };
export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const samples = await prisma.passport.findMany({ where: { published: true }, include: { lot: { include: { owner: true } } }, take: 6, orderBy: { createdAt: "desc" } });
  return (
    <div className="grain min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2"><Logo size={28} /><span className="font-display text-xl">CottonTrace</span></Link>
        <Link href="/sign-in" className="text-sm text-ink-2 hover:text-ink">Partner sign in</Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-madder">for shoppers</div>
        <h1 className="mt-2 font-display text-5xl leading-[1] tracking-tight md:text-6xl">
          Scan the tag.<br /><em className="italic text-indigo">Meet the makers.</em>
        </h1>
        <p className="mt-4 max-w-xl text-ink-2">Point your camera at the QR code on a CottonTrace hang tag, or type the passport ID printed beneath it.</p>
        <Scanner />
        {samples.length > 0 && (
          <div className="mt-12">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Try a live passport</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {samples.map((p) => (
                <Link key={p.id} href={`/p/${p.publicId}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 transition hover:-translate-y-0.5 hover:border-ink-2">
                  <span className="size-10 shrink-0 rounded-xl" style={{ background: p.colorHex }} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.productName}</div>
                    <div className="font-mono text-[11px] text-muted">{p.publicId} · {p.lot.owner.name}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
