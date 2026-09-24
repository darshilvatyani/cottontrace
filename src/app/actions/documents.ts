"use server";

import { revalidatePath } from "next/cache";
import { anchorDocument } from "@/lib/chain/contracts";
import { sha256, txHashOf } from "@/lib/chain/ledger";
import { DOC_KINDS } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { actorOf, requireMember } from "@/lib/session";
import { deleteStored, forgeCopy, readStored, saveFile } from "@/lib/storage";
import { run } from "./_run";

const MAX_BYTES = 8 * 1024 * 1024;

export async function uploadDocumentAction(form: FormData) {
  return run(async () => {
    const user = await requireMember();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "OTHER");
    const lotId = (form.get("lotId") as string) || null;
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload");
    if (file.size > MAX_BYTES) throw new Error("File is larger than 8 MB");
    if (!DOC_KINDS.includes(kind as (typeof DOC_KINDS)[number])) throw new Error("Unknown document type");
    const bytes = Buffer.from(await file.arrayBuffer());
    const digest = sha256(bytes);
    const storagePath = await saveFile(file.name, bytes, file.type || "application/octet-stream");
    const { result, txHash, blockNumber } = await anchorDocument(actorOf(user), {
      lotId,
      name: file.name,
      kind,
      sha256: digest,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      storagePath,
    });
    revalidatePath("/documents");
    revalidatePath("/lots", "layout");
    return { id: result.id, sha256: digest, txHash, blockNumber };
  });
}

/** Three-way check: stored file ⇄ database digest ⇄ digest committed on the ledger. */
async function integrityOf(documentId: string, candidate?: Buffer) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");
  const tx = doc.txHash ? await prisma.ledgerTx.findUnique({ where: { id: doc.txHash } }) : null;
  const ledgerDigest = tx ? (JSON.parse(tx.args).sha256 as string) : null;
  const txIntact = tx ? txHashOf(tx) === tx.id : false;
  let storedDigest: string | null = null;
  try {
    storedDigest = sha256(await readStored(doc.storagePath));
  } catch {
    storedDigest = null;
  }
  const candidateDigest = candidate ? sha256(candidate) : null;
  const reference = ledgerDigest ?? doc.sha256;
  return {
    name: doc.name,
    recorded: doc.sha256,
    ledger: ledgerDigest,
    stored: storedDigest,
    candidate: candidateDigest,
    txIntact,
    blockNumber: tx?.blockNumber ?? null,
    storedMatches: storedDigest === reference,
    candidateMatches: candidateDigest ? candidateDigest === reference : null,
  };
}

export async function verifyStoredDocumentAction(documentId: string) {
  return run(async () => {
    await requireMember();
    return integrityOf(documentId);
  });
}

export async function verifyUploadedDocumentAction(form: FormData) {
  return run(async () => {
    await requireMember();
    const file = form.get("file");
    const id = String(form.get("documentId"));
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to compare");
    return integrityOf(id, Buffer.from(await file.arrayBuffer()));
  });
}

export async function tamperDocumentAction(documentId: string) {
  return run(async () => {
    const user = await requireMember();
    if (!["ADMIN", "AUDITOR"].includes(user.role)) throw new Error("Only auditors can run the tamper demonstration");
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    // Swap in a forged copy behind the ledger's back; the original is kept for restore.
    if (!doc.originalPath) {
      const forged = await forgeCopy(doc.storagePath, doc.name);
      await prisma.document.update({ where: { id: doc.id }, data: { storagePath: forged, originalPath: doc.storagePath } });
    }
    revalidatePath("/documents");
    return integrityOf(documentId);
  });
}

export async function restoreDocumentAction(documentId: string) {
  return run(async () => {
    const user = await requireMember();
    if (!["ADMIN", "AUDITOR"].includes(user.role)) throw new Error("Only auditors can restore documents");
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    if (doc.originalPath) {
      await deleteStored(doc.storagePath);
      await prisma.document.update({ where: { id: doc.id }, data: { storagePath: doc.originalPath, originalPath: null } });
    }
    revalidatePath("/documents");
    return integrityOf(documentId);
  });
}
