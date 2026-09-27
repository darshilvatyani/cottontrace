import Link from "next/link";
import { ExternalLink, Printer, QrCode } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { hasNetworkView, requireMember } from "@/lib/session";
import { ButtonLink, Card, Empty, Kicker, PageHeader } from "@/components/ui";
import { LotIcon } from "@/components/stage-icon";
import { dateFmt, fmt } from "@/lib/utils";

export const metadata = { title: "Product Passports" };

export default async function PassportsPage() {
  const user = await requireMember();
  const orgId = user.organization.id;
  const network = hasNetworkView(user);
  const [passports, eligible] = await Promise.all([
    prisma.passport.findMany({
      where: network && user.role !== "BRAND" ? {} : { lot: { ownerId: orgId } },
      include: { lot: { include: { owner: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lot.findMany({ where: { ownerId: orgId, type: "GARMENT_BATCH", status: "ACTIVE", passport: null } }),
  ]);
  const canIssue = ["BRAND", "GARMENT_FACTORY"].includes(user.organization.type);

  return (
    <div className="space-y-8">
      <PageHeader kicker="PassportContract · QR" title={<>Digital Product <em className="italic text-indigo">Passports</em></>}>
        The QR code on the hang tag is the bridge between a physical garment and its verified journey. Consumers see an
        approved, privacy-safe story — never supplier prices or personal data.
      </PageHeader>

      {canIssue && eligible.length > 0 && (
        <Card className="border-turmeric/50 bg-turmeric-soft/50 p-5">
          <Kicker>ready for a passport</Kicker>
          <div className="mt-3 flex flex-wrap gap-3">
            {eligible.map((l) => (
              <ButtonLink key={l.id} href={`/passports/new?lot=${l.code}`} variant="outline">
                <LotIcon type={l.type} size={15} /> {l.code} · {fmt(l.quantity)} pcs
              </ButtonLink>
            ))}
          </div>
        </Card>
      )}

      {passports.length ? (
        <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {passports.map((p) => (
            <div key={p.id} className="group relative">
              <div
                className="relative overflow-hidden bg-card ring-1 ring-line transition group-hover:-translate-y-1 group-hover:shadow-xl"
                style={{ clipPath: "polygon(18% 0, 82% 0, 100% 8%, 100% 100%, 0 100%, 0 8%)", borderRadius: 18 }}
              >
                <div className="relative px-6 pb-5 pt-9 text-paper" style={{ background: p.colorHex }}>
                  <div className="eyelet absolute left-1/2 top-3 -translate-x-1/2" />
                  <div className="absolute inset-0 opacity-30 weave" style={{ background: "transparent" }} />
                  <div className="relative font-mono text-[10px] uppercase tracking-[0.2em] text-paper/70">{p.lot.owner.name}</div>
                  <div className="relative mt-1 font-display text-2xl leading-tight">{p.productName}</div>
                  <div className="relative mt-1 text-xs text-paper/70">{p.style} · {p.colorName}</div>
                </div>
                <div className="flex gap-4 p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/qr/${p.publicId}`} alt={`QR for ${p.publicId}`} className="size-28 shrink-0 rounded-lg bg-paper p-1.5 ring-1 ring-line" />
                  <div className="min-w-0 flex-1 space-y-2 text-sm">
                    <div><Kicker>Passport</Kicker><div className="font-mono text-xs font-bold">{p.publicId}</div></div>
                    <div><Kicker>Lot</Kicker><Link href={`/lots/${p.lot.code}`} className="font-mono text-xs text-indigo hover:underline">{p.lot.code}</Link></div>
                    <div className="flex gap-4">
                      <div><Kicker>Scans</Kicker><div className="font-display text-xl">{p.scanCount}</div></div>
                      <div><Kicker>Issued</Kicker><div className="text-xs">{dateFmt(p.createdAt)}</div></div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-dashed border-line px-6 py-4">
                  <ButtonLink href={`/p/${p.publicId}`} target="_blank" className="h-9 flex-1"><ExternalLink size={14} /> Open</ButtonLink>
                  <ButtonLink href={`/tag/${p.publicId}`} target="_blank" variant="outline" className="h-9"><Printer size={14} /> Hang tag</ButtonLink>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No passports yet" action={canIssue && eligible[0] ? <ButtonLink href={`/passports/new?lot=${eligible[0].code}`}><QrCode size={15} /> Issue the first one</ButtonLink> : undefined}>
          {canIssue ? "Accept a garment batch, then issue its passport here." : "Brands and garment factories issue passports for finished garments."}
        </Empty>
      )}
    </div>
  );
}
