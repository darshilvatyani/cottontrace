import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { hasNetworkView, requireMember } from "@/lib/session";
import { LOT_ORDER, LOT_TYPES, lotTypesForOrg, type LotType, type OrgType } from "@/lib/domain";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";
import { LotTag } from "@/components/lot-tag";
import { LotIcon } from "@/components/stage-icon";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Lots & Genealogy" };

type SP = Promise<{ type?: string; status?: string; scope?: string; q?: string }>;

export default async function LotsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireMember();
  const sp = await searchParams;
  const network = hasNetworkView(user);
  const scope = sp.scope ?? (network ? "network" : "mine");
  const status = sp.status ?? "live";

  const where: Prisma.LotWhereInput = {};
  if (scope === "mine") where.OR = [{ ownerId: user.organization.id }, { creatorId: user.organization.id }];
  if (sp.type && LOT_ORDER.includes(sp.type as LotType)) where.type = sp.type;
  if (status === "live") where.status = { in: ["ACTIVE", "IN_TRANSIT"] };
  else if (status !== "all") where.status = status;
  if (sp.q) where.OR = [{ code: { contains: sp.q.toUpperCase() } }, { name: { contains: sp.q } }];

  const [lots, counts] = await Promise.all([
    prisma.lot.findMany({ where, include: { owner: true }, orderBy: [{ createdAt: "desc" }], take: 120 }),
    prisma.lot.groupBy({ by: ["type"], _count: true, where: { ...where, type: undefined } }),
  ]);
  const creatable = lotTypesForOrg(user.organization.type as OrgType);

  const href = (patch: Record<string, string | undefined>) => {
    const next = { type: sp.type, status, scope, q: sp.q, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    return `/lots?${qs}`;
  };

  return (
    <div>
      <PageHeader
        kicker="Digital identities"
        title={<>Every lot, <em className="italic text-indigo">tagged &amp; traceable</em></>}
        action={creatable.map((t) => (
          <ButtonLink key={t} href={`/lots/new?type=${t}`} variant={t === creatable[0] ? "primary" : "outline"}>
            <Plus size={15} /> {LOT_TYPES[t].label}
          </ButtonLink>
        ))}
      >
        Seed lots, harvests, bales, fibre, yarn, fabric and garments — each with parent → child links to the material it was made from.
      </PageHeader>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Link href={href({ type: undefined })} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold", !sp.type ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink-2")}>
            All · {counts.reduce((s, c) => s + c._count, 0)}
          </Link>
          {LOT_ORDER.map((t) => {
            const c = counts.find((x) => x.type === t)?._count ?? 0;
            const active = sp.type === t;
            return (
              <Link key={t} href={href({ type: t })} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", active ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink-2", !c && !active && "opacity-50")}>
                <LotIcon type={t} size={15} style={{ color: active ? "#d6a021" : LOT_TYPES[t].color }} />
                {LOT_TYPES[t].plural} <span className="font-mono text-[11px] opacity-70">{c}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/lots" className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={sp.q} placeholder="Search code or name" className="h-9 w-52 rounded-full border border-line bg-card pl-9 pr-3 text-sm outline-none focus:border-indigo" />
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="status" value={status} />
          </form>
          <Segmented items={[["mine", "Mine"], ["network", "Network"]]} value={scope} href={(v) => href({ scope: v })} />
          <Segmented items={[["live", "Live"], ["CONSUMED", "Consumed"], ["all", "All"]]} value={status} href={(v) => href({ status: v })} />
        </div>
      </div>

      {lots.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {lots.map((l) => (
            <LotTag key={l.id} lot={l} />
          ))}
        </div>
      ) : (
        <Empty title="No lots match" action={creatable[0] ? <ButtonLink href={`/lots/new?type=${creatable[0]}`}><Plus size={15} /> Create one</ButtonLink> : undefined}>
          Try another filter{scope === "mine" ? ", or switch to the network view" : ""}.
        </Empty>
      )}
    </div>
  );
}

function Segmented({ items, value, href }: { items: [string, string][]; value: string; href: (v: string) => string }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-card p-0.5">
      {items.map(([v, l]) => (
        <Link key={v} href={href(v)} className={cn("rounded-full px-3 py-1 text-xs font-semibold", value === v ? "bg-indigo text-paper" : "text-ink-2 hover:text-ink")}>
          {l}
        </Link>
      ))}
    </div>
  );
}
