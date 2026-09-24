import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { getLineage } from "@/lib/trace";
import { safeJson } from "@/lib/domain";
import { Empty, PageHeader, ButtonLink } from "@/components/ui";
import { PassportForm } from "./passport-form";

export const metadata = { title: "Issue passport" };

export default async function NewPassportPage({ searchParams }: { searchParams: Promise<{ lot?: string }> }) {
  const user = await requireMember();
  const { lot: code } = await searchParams;
  if (!code) notFound();
  const lot = await prisma.lot.findUnique({ where: { code }, include: { passport: true, owner: true } });
  if (!lot || lot.type !== "GARMENT_BATCH") notFound();
  if (lot.ownerId !== user.organization.id)
    return <Empty title="You don't own this batch" action={<ButtonLink href="/passports">Back</ButtonLink>}>Only the current owner can publish its passport.</Empty>;

  const { lots } = await getLineage(lot.id, "up");
  const dye = lots.find((l) => l.type === "DYED_FABRIC");
  const dyeAttrs = dye ? safeJson<Record<string, string>>(dye.attributes) : {};
  const attrs = safeJson<Record<string, string>>(lot.attributes);
  const farm = lots.find((l) => l.type === "HARVEST_LOT");
  const p = lot.passport;

  return (
    <div>
      <PageHeader kicker={`PassportContract · publishPassport · ${lot.code}`} title={<>{p ? "Update" : "Issue"} the <em className="italic text-indigo">passport</em></>}>
        Choose what the consumer sees. The journey, certifications and sustainability figures are pulled automatically from
        the verified genealogy and cannot be edited here.
      </PageHeader>
      <PassportForm
        lotId={lot.id}
        brand={lot.owner.name}
        initial={{
          productName: p?.productName ?? lot.name,
          style: p?.style ?? attrs.style ?? "Crew-neck T-shirt",
          colorName: p?.colorName ?? dyeAttrs.shade ?? "Natural",
          colorHex: p?.colorHex ?? dyeAttrs.shadeHex ?? "#e9e2d2",
          sizes: p?.sizes ?? attrs.sizes ?? "S – XL",
          description: p?.description ?? `Made from cotton grown in ${farm?.owner.city ?? "India"} and traced through every stage of production.`,
          care: p ? safeJson<string[]>(p.care, []) : ["Machine wash cold", "Line dry in shade", "Do not bleach"],
          endOfLife: p?.endOfLife ?? "100% cotton — return to a textile recycling point or compost after removing labels.",
        }}
      />
    </div>
  );
}
