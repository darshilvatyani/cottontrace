import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/chain/contracts";
import type { OrgType, Role } from "@/lib/domain";

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    include: { organization: true },
  });
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
export type MemberUser = CurrentUser & { organization: NonNullable<CurrentUser["organization"]> };

/** Require a signed-in user who has completed onboarding into an organisation. */
export async function requireMember(): Promise<MemberUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.organization) redirect("/onboarding");
  return user as MemberUser;
}

export function actorOf(user: MemberUser): Actor {
  return {
    userId: user.id,
    orgId: user.organization.id,
    orgType: user.organization.type as OrgType,
    msp: user.organization.mspId,
    role: user.role as Role,
  };
}

/** Auditors, brands and admins get network-wide visibility on list pages. */
export function hasNetworkView(user: MemberUser) {
  return user.role === "ADMIN" || user.role === "AUDITOR" || user.role === "BRAND";
}
