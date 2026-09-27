import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/stage-icon";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Set up your organisation" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.organizationId) redirect("/dashboard");
  const orgs = await prisma.organization.findMany({
    where: { code: { not: "NET-OPS" } },
    select: { id: true, name: true, type: true, city: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="grain min-h-screen px-5 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex items-center gap-2.5">
          <Logo size={32} /> <span className="font-display text-xl">CottonTrace</span>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-madder">Step 2 of 2</div>
        <h1 className="mt-2 font-display text-5xl tracking-tight">Where do you sit in the chain, {user.name.split(" ")[0]}?</h1>
        <p className="mt-3 max-w-2xl text-ink-2">
          Each organisation gets its own ledger identity (MSP). Your organisation&apos;s type decides which lots you can
          create and who you can hand material to.
        </p>
        <OnboardingForm orgs={orgs} />
      </div>
    </div>
  );
}
