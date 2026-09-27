import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { LOT_TYPES, lotMassKg, lotTypesForOrg, type LotType, type OrgType } from "@/lib/domain";
import { PageHeader, Empty, ButtonLink } from "@/components/ui";
import { NewLotForm } from "./new-lot-form";

export const metadata = { title: "Register a lot" };

export default async function NewLotPage({ searchParams }: { searchParams: Promise<{ type?: string; from?: string }> }) {
  const user = await requireMember();
  const sp = await searchParams;
  const types = lotTypesForOrg(user.organization.type as OrgType);
  if (!types.length)
    return (
      <Empty title="Your organisation doesn't create lots" action={<ButtonLink href="/lots">Browse lots</ButtonLink>}>
        {user.organization.name} receives, certifies or sells material rather than transforming it.
      </Empty>
    );
  const type = (types.includes(sp.type as LotType) ? sp.type : types[0]) as LotType;
  if (sp.type && sp.type !== type) redirect(`/lots/new?type=${type}`);

  const allInputTypes = [...new Set(types.flatMap((t) => LOT_TYPES[t].inputs))];
  const [inputs, fields] = await Promise.all([
    prisma.lot.findMany({
      where: { ownerId: user.organization.id, status: "ACTIVE", type: { in: allInputTypes }, available: { gt: 0 } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.field.findMany({ where: { orgId: user.organization.id } }),
  ]);

  return (
    <div>
      <PageHeader kicker={`LotContract · createLot · signed as ${user.organization.mspId}`} title={<>Register a <em className="italic text-indigo">new lot</em></>}>
        The smart contract checks your role, the ownership and availability of every input, and the mass balance of the
        transformation before sealing it into a block.
      </PageHeader>
      <NewLotForm
        types={types}
        initialType={type}
        preselect={sp.from}
        fields={fields.map((f) => ({ id: f.id, label: `${f.name} (${f.code}) · ${f.areaHa} ha` }))}
        inputs={inputs.map((l) => ({
          id: l.id,
          code: l.code,
          type: l.type,
          name: l.name,
          available: l.available,
          unit: l.unit,
          kgPerUnit: lotMassKg(l, 1),
        }))}
      />
    </div>
  );
}
