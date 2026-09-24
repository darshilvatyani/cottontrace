"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAnomalyScan } from "@/lib/ai/detector";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { run } from "./_run";

export async function runScanAction() {
  return run(async () => {
    await requireMember();
    const res = await runAnomalyScan();
    revalidatePath("/insights");
    revalidatePath("/dashboard");
    return res;
  });
}

const reviewSchema = z.object({
  id: z.string(),
  status: z.enum(["CONFIRMED", "DISMISSED", "OPEN"]),
  note: z.string().trim().max(500).optional(),
});

export async function reviewAnomalyAction(payload: z.input<typeof reviewSchema>) {
  return run(async () => {
    const user = await requireMember();
    if (!["AUDITOR", "ADMIN"].includes(user.role)) throw new Error("Only auditors can review anomalies");
    const input = reviewSchema.parse(payload);
    await prisma.anomaly.update({
      where: { id: input.id },
      data: {
        status: input.status,
        reviewNote: input.note ?? null,
        reviewedById: input.status === "OPEN" ? null : user.id,
        reviewedAt: input.status === "OPEN" ? null : new Date(),
      },
    });
    revalidatePath("/insights");
    return { id: input.id };
  });
}
