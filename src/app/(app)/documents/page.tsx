import { prisma } from "@/lib/prisma";
import { hasNetworkView, requireMember } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { DocumentsBoard } from "./documents-board";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const user = await requireMember();
  const orgId = user.organization.id;
  const network = hasNetworkView(user);
  const [docs, lots] = await Promise.all([
    prisma.document.findMany({
      where: network ? {} : { OR: [{ orgId }, { lot: { ownerId: orgId } }, { lot: { creatorId: orgId } }] },
      include: { lot: true, org: true, uploadedBy: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lot.findMany({ where: { OR: [{ ownerId: orgId }, { creatorId: orgId }] }, select: { id: true, code: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const blocks = new Map(
    (await prisma.ledgerTx.findMany({ where: { id: { in: docs.map((d) => d.txHash!).filter(Boolean) } }, select: { id: true, blockNumber: true } })).map((t) => [t.id, t.blockNumber]),
  );

  return (
    <div>
      <PageHeader kicker="DocumentContract · off-chain storage" title={<>Paper trail, <em className="italic text-indigo">fingerprinted</em></>}>
        Certificates, lab reports and inspections stay off-chain; their SHA-256 digests are committed to the ledger. Change a
        single byte and the fingerprint no longer matches.
      </PageHeader>
      <DocumentsBoard
        canTamper={["AUDITOR", "ADMIN"].includes(user.role)}
        lots={lots}
        docs={docs.map((d) => ({
          id: d.id,
          name: d.name,
          kind: d.kind,
          size: d.size,
          sha256: d.sha256,
          txHash: d.txHash,
          block: d.txHash ? (blocks.get(d.txHash) ?? null) : null,
          lot: d.lot?.code ?? null,
          org: d.org.name,
          by: d.uploadedBy?.name ?? null,
          createdAt: d.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
