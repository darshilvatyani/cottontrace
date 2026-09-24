/**
 * A lightweight permissioned ledger modelled on Hyperledger Fabric concepts:
 *  - organisations submit transactions under their MSP identity
 *  - chaincode ("smart contracts") validates each invocation before commit
 *  - valid transactions are ordered into hash-linked blocks with a Merkle root
 *  - rejected invocations are recorded (never committed) for auditability
 *
 * The ledger lives in the same database as the operational data, but every
 * block and transaction can be re-hashed to prove it has not been altered.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type Db = Prisma.TransactionClient;

export const CHANNEL = "cotton-channel";
export const ZERO_HASH = "0".repeat(64);

export function sha256(input: string | Buffer | Uint8Array) {
  return createHash("sha256").update(input).digest("hex");
}

/** Deterministic JSON (sorted keys) so hashes are reproducible. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`;
}

export function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return ZERO_HASH;
  let level = [...hashes];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      next.push(sha256(left + right));
    }
    level = next;
  }
  return level[0];
}

export function txHashOf(tx: { contract: string; fn: string; args: string; submitterMsp: string; createdAt: Date }) {
  return sha256(
    canonical({
      contract: tx.contract,
      fn: tx.fn,
      args: tx.args,
      msp: tx.submitterMsp,
      ts: tx.createdAt.toISOString(),
    }),
  );
}

export function blockHashOf(b: { number: number; prevHash: string; merkleRoot: string; timestamp: Date; channel: string }) {
  return sha256(
    canonical({
      number: b.number,
      prevHash: b.prevHash,
      merkleRoot: b.merkleRoot,
      ts: b.timestamp.toISOString(),
      channel: b.channel,
    }),
  );
}

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

export function require_(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ContractError(message);
}

export type InvokeMeta = {
  contract: string;
  fn: string;
  msp: string;
  /** Raw request, stored if the contract rejects the invocation. */
  intent: Record<string, unknown>;
  lotCode?: string;
  endorsers?: string[];
  at?: Date;
};

export type InvokeBody<T> = (db: Db) => Promise<{
  args: Record<string, unknown>;
  lotCode?: string;
  apply: (txHash: string, at: Date) => Promise<T>;
}>;

export type InvokeResult<T> = { result: T; txHash: string; blockNumber: number };

/**
 * Execute a chaincode function: validate → apply state changes → commit block,
 * atomically. A ContractError rolls everything back and logs a REJECTED tx.
 */
export async function invoke<T>(meta: InvokeMeta, body: InvokeBody<T>): Promise<InvokeResult<T>> {
  const at = meta.at ?? new Date();
  try {
    return await prisma.$transaction(
      async (db) => {
        const { args, lotCode, apply } = await body(db);
        const argsJson = canonical({ ...args, nonce: randomBytes(6).toString("hex") });
        const txHash = txHashOf({ contract: meta.contract, fn: meta.fn, args: argsJson, submitterMsp: meta.msp, createdAt: at });
        const result = await apply(txHash, at);
        const blockNumber = await commitBlock(db, at, meta.endorsers ?? [meta.msp], [
          {
            id: txHash,
            contract: meta.contract,
            fn: meta.fn,
            args: argsJson,
            submitterMsp: meta.msp,
            lotCode: lotCode ?? meta.lotCode ?? null,
            createdAt: at,
          },
        ]);
        return { result, txHash, blockNumber };
      },
      { timeout: 20_000 },
    );
  } catch (err) {
    if (err instanceof ContractError) {
      const argsJson = canonical({ ...meta.intent, nonce: randomBytes(6).toString("hex") });
      await prisma.ledgerTx.create({
        data: {
          id: txHashOf({ contract: meta.contract, fn: meta.fn, args: argsJson, submitterMsp: meta.msp, createdAt: at }),
          contract: meta.contract,
          fn: meta.fn,
          args: argsJson,
          submitterMsp: meta.msp,
          lotCode: meta.lotCode ?? null,
          status: "REJECTED",
          reason: err.message,
          createdAt: at,
        },
      });
    }
    throw err;
  }
}

type PendingTx = {
  id: string;
  contract: string;
  fn: string;
  args: string;
  submitterMsp: string;
  lotCode: string | null;
  createdAt: Date;
};

async function commitBlock(db: Db, at: Date, endorsers: string[], txs: PendingTx[]) {
  const last = await db.block.findFirst({ orderBy: { number: "desc" } });
  const number = last ? last.number + 1 : 0;
  const prevHash = last?.hash ?? ZERO_HASH;
  const timestamp = last && last.timestamp > at ? new Date(last.timestamp.getTime() + 1) : at;
  const root = merkleRoot(txs.map((t) => t.id));
  const hash = blockHashOf({ number, prevHash, merkleRoot: root, timestamp, channel: CHANNEL });
  await db.block.create({
    data: {
      number,
      hash,
      prevHash,
      merkleRoot: root,
      channel: CHANNEL,
      endorsers: JSON.stringify([...new Set(endorsers)]),
      timestamp,
    },
  });
  await db.ledgerTx.createMany({
    data: txs.map((t) => ({ ...t, blockNumber: number, status: "VALID" })),
  });
  return number;
}

/** Create the genesis block that records the channel configuration. */
export async function ensureGenesis(members: string[], at = new Date()) {
  const existing = await prisma.block.findUnique({ where: { number: 0 } });
  if (existing) return existing;
  return prisma.$transaction(async (db) => {
    const args = canonical({ channel: CHANNEL, members, policy: "MAJORITY Endorsement", nonce: "genesis" });
    const id = txHashOf({ contract: "_lifecycle", fn: "configureChannel", args, submitterMsp: "OrdererMSP", createdAt: at });
    await commitBlock(db, at, ["OrdererMSP"], [
      { id, contract: "_lifecycle", fn: "configureChannel", args, submitterMsp: "OrdererMSP", lotCode: null, createdAt: at },
    ]);
    return db.block.findUniqueOrThrow({ where: { number: 0 } });
  });
}

export type ChainIssue = { block: number; kind: "TX_HASH" | "MERKLE" | "BLOCK_HASH" | "LINK"; message: string; txId?: string };

/** Recompute every hash in the chain and report anything that does not match. */
export async function verifyChain() {
  const blocks = await prisma.block.findMany({ orderBy: { number: "asc" }, include: { transactions: true } });
  const issues: ChainIssue[] = [];
  let prev = ZERO_HASH;
  let txCount = 0;
  for (const b of blocks) {
    const txs = [...b.transactions].sort((a, z) => a.createdAt.getTime() - z.createdAt.getTime());
    for (const tx of txs) {
      txCount++;
      const recomputed = txHashOf(tx);
      if (recomputed !== tx.id)
        issues.push({ block: b.number, kind: "TX_HASH", txId: tx.id, message: `Transaction ${tx.id.slice(0, 12)}… payload no longer matches its hash` });
    }
    const root = merkleRoot(txs.map((t) => t.id));
    if (root !== b.merkleRoot) issues.push({ block: b.number, kind: "MERKLE", message: `Merkle root mismatch in block #${b.number}` });
    if (b.prevHash !== prev) issues.push({ block: b.number, kind: "LINK", message: `Block #${b.number} does not link to the previous block hash` });
    const h = blockHashOf(b);
    if (h !== b.hash) issues.push({ block: b.number, kind: "BLOCK_HASH", message: `Header hash of block #${b.number} is invalid` });
    prev = b.hash;
  }
  return { ok: issues.length === 0, blocks: blocks.length, txs: txCount, issues, checkedAt: new Date() };
}

/** Verify that a lot's current record still matches the payload committed on-chain. */
export async function verifyLotRecord(lot: { code: string; type: string; quantity: number; txHash: string | null }) {
  if (!lot.txHash) return { ok: false, reason: "No ledger transaction" };
  const tx = await prisma.ledgerTx.findUnique({ where: { id: lot.txHash } });
  if (!tx || tx.status !== "VALID") return { ok: false, reason: "Transaction not found on ledger" };
  if (txHashOf(tx) !== tx.id) return { ok: false, reason: "Ledger transaction was altered" };
  const args = JSON.parse(tx.args) as Record<string, unknown>;
  if (args.code !== lot.code || args.type !== lot.type) return { ok: false, reason: "Identity mismatch" };
  if (Math.abs(Number(args.quantity) - lot.quantity) > 1e-6) return { ok: false, reason: "Quantity differs from ledger" };
  return { ok: true, reason: "Matches ledger", blockNumber: tx.blockNumber };
}
