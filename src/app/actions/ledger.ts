"use server";

import { revalidatePath } from "next/cache";
import { verifyChain } from "@/lib/chain/ledger";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { run } from "./_run";

const BACKUP_KEY = "ledger-tamper";

export async function verifyChainAction() {
  return run(async () => {
    await requireMember();
    return verifyChain();
  });
}

/** Demo: silently edit a committed transaction in the database, as a malicious insider might. */
export async function tamperLedgerAction() {
  return run(async () => {
    const user = await requireMember();
    if (user.role !== "ADMIN") throw new Error("Only the network admin can run the tamper demonstration");
    if (await prisma.demoBackup.findUnique({ where: { key: BACKUP_KEY } })) throw new Error("A tampered transaction already exists — restore it first");
    const tx = await prisma.ledgerTx.findFirst({
      where: { status: "VALID", fn: "createLot", lotCode: { startsWith: "BALE" } },
      orderBy: { createdAt: "asc" },
    });
    if (!tx) throw new Error("No suitable transaction found");
    const args = JSON.parse(tx.args);
    const forged = { ...args, quantity: Math.round(Number(args.quantity) * 1.4) };
    await prisma.$transaction([
      prisma.demoBackup.create({ data: { key: BACKUP_KEY, value: JSON.stringify({ id: tx.id, args: tx.args }) } }),
      prisma.ledgerTx.update({ where: { id: tx.id }, data: { args: JSON.stringify(forged) } }),
    ]);
    revalidatePath("/ledger");
    return { txId: tx.id, block: tx.blockNumber, from: args.quantity, to: forged.quantity };
  });
}

export async function restoreLedgerAction() {
  return run(async () => {
    const user = await requireMember();
    if (user.role !== "ADMIN") throw new Error("Only the network admin can restore the ledger");
    const backup = await prisma.demoBackup.findUnique({ where: { key: BACKUP_KEY } });
    if (!backup) throw new Error("Nothing to restore");
    const { id, args } = JSON.parse(backup.value);
    await prisma.$transaction([
      prisma.ledgerTx.update({ where: { id }, data: { args } }),
      prisma.demoBackup.delete({ where: { key: BACKUP_KEY } }),
    ]);
    revalidatePath("/ledger");
    return { txId: id };
  });
}
