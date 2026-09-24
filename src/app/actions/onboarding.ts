"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ORG_TYPES, type OrgType } from "@/lib/domain";
import { PLACES } from "@/lib/places";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { run } from "./_run";

const schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    orgType: z.enum(Object.keys(ORG_TYPES) as [OrgType, ...OrgType[]]),
    orgName: z.string().trim().min(3).max(80),
    place: z.string(),
  }),
  z.object({ mode: z.literal("join"), orgId: z.string() }),
]);

export async function completeOnboardingAction(payload: z.input<typeof schema>) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Please sign in again");
    if (user.organizationId) return { ok: true };
    const input = schema.parse(payload);

    let org;
    if (input.mode === "join") {
      org = await prisma.organization.findUniqueOrThrow({ where: { id: input.orgId } });
    } else {
      const place = PLACES.find((p) => p.key === input.place);
      if (!place) throw new Error("Choose a location");
      const slug = input.orgName.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 10).toUpperCase() || "ORG";
      const def = ORG_TYPES[input.orgType];
      let code = `${def.short.toUpperCase()}-${slug}`;
      while (await prisma.organization.findUnique({ where: { code } })) code = `${code}${Math.floor(Math.random() * 9)}`;
      org = await prisma.organization.create({
        data: {
          name: input.orgName,
          type: input.orgType,
          code,
          mspId: `${slug.charAt(0)}${slug.slice(1).toLowerCase()}${def.short}MSP${Math.floor(Math.random() * 90 + 10)}`,
          city: place.city,
          state: place.state,
          // jitter so co-located members don't overlap on the map
          lat: place.lat + (Math.random() - 0.5) * 0.08,
          lng: place.lng + (Math.random() - 0.5) * 0.08,
        },
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: org.id, role: ORG_TYPES[org.type as OrgType].role },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
