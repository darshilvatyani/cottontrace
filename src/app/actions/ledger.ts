"use server";

import { writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { verifyChain } from "@/lib/chain/ledger";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { STORAGE_ROOT } from "@/lib/storage";
import { run } from "./_run";

const BACKUP = path.join(STORAGE_ROOT, "ledger-tamper.json");

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
    const existing = await readFile(BACKUP, "utf8").catch(() => null);
    if (existing) throw new Error("A tampered transaction already exists — restore it first");
    const tx = await prisma.ledgerTx.findFirst({
      where: { status: "VALID", fn: "createLot", lotCode: { startsWith: "BALE" } },
      orderBy: { createdAt: "asc" },
    });
    if (!tx) throw new Error("No suitable transaction found");
    const args = JSON.parse(tx.args);
    const forged = { ...args, quantity: Math.round(Number(args.quantity) * 1.4) };
    await writeFile(BACKUP, JSON.stringify({ id: tx.id, args: tx.args }));
    await prisma.ledgerTx.update({ where: { id: tx.id }, data: { args: JSON.stringify(forged) } });
    revalidatePath("/ledger");
    return { txId: tx.id, block: tx.blockNumber, from: args.quantity, to: forged.quantity };
  });
}

export async function restoreLedgerAction() {
  return run(async () => {
    const user = await requireMember();
    if (user.role !== "ADMIN") throw new Error("Only the network admin can restore the ledger");
    const raw = await readFile(BACKUP, "utf8").catch(() => null);
    if (!raw) throw new Error("Nothing to restore");
    const { id, args } = JSON.parse(raw);
    await prisma.ledgerTx.update({ where: { id }, data: { args } });
    await unlink(BACKUP);
    revalidatePath("/ledger");
    return { txId: id };
  });
}
