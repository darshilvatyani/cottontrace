import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { ORG_TYPES, ROLE_LABEL, type OrgType, type Role } from "@/lib/domain";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMember();
  const [head, pendingIncoming, openAnomalies] = await Promise.all([
    prisma.block.findFirst({ orderBy: { number: "desc" } }),
    prisma.transfer.count({ where: { toOrgId: user.organization.id, status: "PENDING" } }),
    prisma.anomaly.count({ where: { status: "OPEN" } }),
  ]);

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        roleLabel: ROLE_LABEL[user.role as Role] ?? user.role,
        org: {
          name: user.organization.name,
          type: user.organization.type,
          typeLabel: ORG_TYPES[user.organization.type as OrgType]?.label ?? user.organization.type,
          code: user.organization.code,
        },
      }}
      chain={{ height: head?.number ?? 0, head: head?.hash ?? "" }}
      pendingIncoming={pendingIncoming}
      openAnomalies={openAnomalies}
    >
      {children}
    </AppShell>
  );
}
