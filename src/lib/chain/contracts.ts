/**
 * Chaincode for the cotton channel. Every state-changing operation in the
 * platform goes through one of these functions, which enforce the business
 * rules described in the project report (existence, ownership, quantity,
 * role authorisation and mass balance) before anything is committed.
 */
import {
  LOT_TYPES,
  MANUAL_EVENTS,
  ORG_TYPES,
  TRANSFER_ROUTES,
  EVENT_LABEL,
  lotMassKg,
  safeJson,
  type LotType,
  type OrgType,
  type Role,
} from "@/lib/domain";
import { invoke, require_, type Db } from "./ledger";

export type Actor = {
  userId?: string | null;
  orgId: string;
  orgType: OrgType;
  msp: string;
  role: Role;
};

const EPS = 1e-6;
const round = (n: number) => Math.round(n * 1000) / 1000;

async function nextLotCode(db: Db, type: LotType, at: Date) {
  const def = LOT_TYPES[type];
  const year = at.getFullYear();
  let n = (await db.lot.count({ where: { type } })) + 1;
  for (;;) {
    const code = `${def.prefix}-${year}-${String(n).padStart(4, "0")}`;
    if (!(await db.lot.findUnique({ where: { code } }))) return code;
    n++;
  }
}

// ─────────────────────────── LotContract:createLot ───────────────────────────

export type CreateLotInput = {
  type: LotType;
  name: string;
  quantity: number;
  attributes: Record<string, unknown>;
  season?: string | null;
  fieldId?: string | null;
  inputs: { lotId: string; quantity: number }[];
};

export async function createLot(actor: Actor, input: CreateLotInput, opts: { at?: Date } = {}) {
  const def = LOT_TYPES[input.type];
  return invoke(
    {
      contract: "LotContract",
      fn: "createLot",
      msp: actor.msp,
      intent: { type: input.type, quantity: input.quantity, inputs: input.inputs },
      at: opts.at,
    },
    async (db) => {
      require_(def, `Unknown lot type "${input.type}"`);
      require_(
        def.org === actor.orgType,
        `${ORG_TYPES[actor.orgType]?.label ?? actor.orgType} is not authorised to create a ${def.label}`,
      );
      require_(Number.isFinite(input.quantity) && input.quantity > 0, "Quantity must be greater than zero");
      require_(input.name?.trim(), "A lot name is required");
      for (const f of def.attributes.filter((a) => a.required)) {
        require_(
          input.attributes[f.key] !== undefined && input.attributes[f.key] !== "",
          `Attribute "${f.label}" is required`,
        );
      }

      if (input.fieldId) {
        const field = await db.field.findUnique({ where: { id: input.fieldId } });
        require_(field && field.orgId === actor.orgId, "Field does not belong to your organisation");
      }

      // Validate inputs (transformation sources)
      if (def.inputs.length) require_(input.inputs.length > 0, `A ${def.label} must be produced from at least one input lot`);
      const ids = new Set<string>();
      const sources: { src: NonNullable<Awaited<ReturnType<typeof db.lot.findUnique>>>; qty: number }[] = [];
      let inputMass = 0;
      for (const i of input.inputs) {
        require_(!ids.has(i.lotId), "The same input lot was listed twice");
        ids.add(i.lotId);
        const src = await db.lot.findUnique({ where: { id: i.lotId } });
        require_(src, "Input lot does not exist");
        require_(src.ownerId === actor.orgId, `Input ${src.code} is not owned by your organisation`);
        require_(src.status === "ACTIVE", `Input ${src.code} is ${src.status.toLowerCase().replace("_", " ")}`);
        require_(def.inputs.includes(src.type as LotType), `${LOT_TYPES[src.type as LotType]?.label} cannot be converted into ${def.label}`);
        require_(i.quantity > 0, `Quantity drawn from ${src.code} must be positive`);
        require_(
          i.quantity <= src.available + EPS,
          `Cannot draw ${i.quantity} ${src.unit} from ${src.code}; only ${round(src.available)} ${src.unit} available`,
        );
        inputMass += lotMassKg(src, i.quantity);
        sources.push({ src, qty: i.quantity });
      }

      // Mass-balance rule (physical conservation)
      const outputMass = lotMassKg({ type: input.type, quantity: input.quantity, attributes: input.attributes });
      if (def.maxYield && inputMass > 0) {
        require_(
          outputMass <= inputMass * def.maxYield + EPS,
          `Mass-balance violation: ${round(outputMass)} kg output exceeds the ${Math.round(def.maxYield * 100)}% maximum yield of ${round(inputMass)} kg input`,
        );
      }

      const at = opts.at ?? new Date();
      const code = await nextLotCode(db, input.type, at);
      const args = {
        code,
        type: input.type,
        quantity: input.quantity,
        unit: def.unit,
        owner: actor.msp,
        inputs: sources.map((s) => ({ code: s.src.code, quantity: s.qty })),
        attributes: input.attributes,
      };

      return {
        args,
        lotCode: code,
        apply: async (txHash, at) => {
          const lot = await db.lot.create({
            data: {
              code,
              type: input.type,
              name: input.name.trim(),
              quantity: input.quantity,
              available: input.quantity,
              unit: def.unit,
              attributes: JSON.stringify(input.attributes),
              season: input.season ?? null,
              fieldId: input.fieldId ?? null,
              ownerId: actor.orgId,
              creatorId: actor.orgId,
              createdById: actor.userId ?? null,
              txHash,
              createdAt: at,
            },
          });
          for (const { src, qty } of sources) {
            await db.lotLink.create({ data: { parentId: src.id, childId: lot.id, quantity: qty, createdAt: at } });
            const remaining = round(src.available - qty);
            await db.lot.update({
              where: { id: src.id },
              data: { available: Math.max(0, remaining), status: remaining <= EPS ? "CONSUMED" : src.status },
            });
          }
          await db.traceEvent.create({
            data: {
              lotId: lot.id,
              type: def.verb,
              title: `${EVENT_LABEL[def.verb]} · ${lot.name}`,
              data: JSON.stringify({ quantity: input.quantity, unit: def.unit, inputs: args.inputs, massIn: round(inputMass), massOut: round(outputMass) }),
              orgId: actor.orgId,
              userId: actor.userId ?? null,
              txHash,
              occurredAt: at,
            },
          });
          return lot;
        },
      };
    },
  );
}

// ─────────────────────────── TransferContract ───────────────────────────

export async function transferLot(
  actor: Actor,
  input: { lotId: string; toOrgId: string; quantity: number; note?: string },
  opts: { at?: Date } = {},
) {
  return invoke(
    {
      contract: "TransferContract",
      fn: "initiateTransfer",
      msp: actor.msp,
      intent: input,
      at: opts.at,
    },
    async (db) => {
      const lot = await db.lot.findUnique({ where: { id: input.lotId } });
      require_(lot, "Lot does not exist — it cannot be transferred");
      require_(lot.ownerId === actor.orgId, `${lot.code} is not owned by your organisation`);
      require_(lot.status === "ACTIVE", `${lot.code} is ${lot.status.toLowerCase().replace("_", " ")} and cannot be transferred`);
      require_(input.quantity > 0, "Transfer quantity must be positive");
      require_(
        input.quantity <= lot.available + EPS,
        `Transfer of ${input.quantity} ${lot.unit} exceeds the ${round(lot.available)} ${lot.unit} available in ${lot.code}`,
      );
      const to = await db.organization.findUnique({ where: { id: input.toOrgId } });
      require_(to, "Receiving organisation does not exist");
      require_(to.id !== actor.orgId, "Cannot transfer a lot to your own organisation");
      const allowed = TRANSFER_ROUTES[lot.type as LotType] ?? [];
      require_(
        allowed.includes(to.type as OrgType),
        `A ${ORG_TYPES[to.type as OrgType]?.label ?? to.type} cannot receive a ${LOT_TYPES[lot.type as LotType].label}`,
      );

      return {
        args: { lot: lot.code, from: actor.msp, to: to.mspId, quantity: input.quantity },
        lotCode: lot.code,
        apply: async (txHash, at) => {
          const transfer = await db.transfer.create({
            data: {
              lotId: lot.id,
              fromOrgId: actor.orgId,
              toOrgId: to.id,
              quantity: input.quantity,
              note: input.note ?? null,
              createdById: actor.userId ?? null,
              txHash,
              createdAt: at,
            },
          });
          const remaining = round(lot.available - input.quantity);
          await db.lot.update({
            where: { id: lot.id },
            data: { available: Math.max(0, remaining), status: remaining <= EPS ? "IN_TRANSIT" : "ACTIVE" },
          });
          await db.traceEvent.create({
            data: {
              lotId: lot.id,
              type: "TRANSFER_SENT",
              title: `Dispatched ${input.quantity} ${lot.unit} to ${to.name}`,
              data: JSON.stringify({ to: to.name, quantity: input.quantity, transferId: transfer.id }),
              orgId: actor.orgId,
              userId: actor.userId ?? null,
              txHash,
              occurredAt: at,
            },
          });
          return transfer;
        },
      };
    },
  );
}

export async function respondTransfer(
  actor: Actor,
  input: { transferId: string; action: "ACCEPT" | "REJECT" | "CANCEL" },
  opts: { at?: Date } = {},
) {
  const fn = input.action === "ACCEPT" ? "acceptTransfer" : input.action === "REJECT" ? "rejectTransfer" : "cancelTransfer";
  return invoke(
    { contract: "TransferContract", fn, msp: actor.msp, intent: input, at: opts.at },
    async (db) => {
      const t = await db.transfer.findUnique({ where: { id: input.transferId }, include: { lot: true, fromOrg: true, toOrg: true } });
      require_(t, "Transfer does not exist");
      require_(t.status === "PENDING", `Transfer is already ${t.status.toLowerCase()}`);
      if (input.action === "CANCEL") require_(t.fromOrgId === actor.orgId, "Only the sender can cancel this transfer");
      else require_(t.toOrgId === actor.orgId, "Only the receiving organisation can respond to this transfer");

      const lot = t.lot;
      const whole = input.action === "ACCEPT" && Math.abs(t.quantity - lot.quantity) <= EPS && lot.available <= EPS;
      let splitCode: string | null = null;
      if (input.action === "ACCEPT" && !whole) {
        const n = (await db.lotLink.count({ where: { parentId: lot.id } })) + 1;
        splitCode = `${lot.code}-S${n}`;
        while (await db.lot.findUnique({ where: { code: splitCode } })) splitCode = `${splitCode}x`;
      }

      const args: Record<string, unknown> = {
        transfer: t.id,
        lot: lot.code,
        from: t.fromOrg.mspId,
        to: t.toOrg.mspId,
        quantity: t.quantity,
      };
      if (splitCode) Object.assign(args, { code: splitCode, type: lot.type });

      return {
        args,
        lotCode: splitCode ?? lot.code,
        apply: async (txHash, at) => {
          if (input.action !== "ACCEPT") {
            await db.transfer.update({
              where: { id: t.id },
              data: { status: input.action === "REJECT" ? "REJECTED" : "CANCELLED", respondedAt: at },
            });
            await db.lot.update({
              where: { id: lot.id },
              data: { available: round(lot.available + t.quantity), status: "ACTIVE" },
            });
            await db.traceEvent.create({
              data: {
                lotId: lot.id,
                type: "OBSERVATION",
                title: `Transfer to ${t.toOrg.name} ${input.action === "REJECT" ? "rejected" : "cancelled"}`,
                orgId: actor.orgId,
                userId: actor.userId ?? null,
                txHash,
                occurredAt: at,
              },
            });
            return { lotId: lot.id };
          }

          let resultId = lot.id;
          if (whole) {
            await db.lot.update({
              where: { id: lot.id },
              data: { ownerId: t.toOrgId, available: lot.quantity, status: "ACTIVE" },
            });
          } else {
            const child = await db.lot.create({
              data: {
                code: splitCode!,
                type: lot.type,
                name: lot.name,
                quantity: t.quantity,
                available: t.quantity,
                unit: lot.unit,
                attributes: lot.attributes,
                season: lot.season,
                fieldId: lot.fieldId,
                certified: lot.certified,
                ownerId: t.toOrgId,
                creatorId: lot.creatorId,
                createdById: lot.createdById,
                txHash,
                createdAt: at,
              },
            });
            await db.lotLink.create({ data: { parentId: lot.id, childId: child.id, quantity: t.quantity, createdAt: at } });
            if (lot.available <= EPS) await db.lot.update({ where: { id: lot.id }, data: { status: "CONSUMED" } });
            await db.traceEvent.create({
              data: {
                lotId: lot.id,
                type: "SPLIT",
                title: `Split ${t.quantity} ${lot.unit} into ${splitCode}`,
                data: JSON.stringify({ child: splitCode }),
                orgId: t.fromOrgId,
                txHash,
                occurredAt: at,
              },
            });
            resultId = child.id;
          }
          await db.transfer.update({ where: { id: t.id }, data: { status: "ACCEPTED", respondedAt: at, resultLotId: resultId } });
          await db.traceEvent.create({
            data: {
              lotId: resultId,
              type: "TRANSFER_RECEIVED",
              title: `Received ${t.quantity} ${lot.unit} from ${t.fromOrg.name}`,
              data: JSON.stringify({ from: t.fromOrg.name, quantity: t.quantity }),
              orgId: actor.orgId,
              userId: actor.userId ?? null,
              txHash,
              occurredAt: at,
            },
          });
          return { lotId: resultId };
        },
      };
    },
  );
}

// ─────────────────────────── EventContract ───────────────────────────

export async function recordEvent(
  actor: Actor,
  input: { lotId: string; type: string; title: string; data?: Record<string, unknown> },
  opts: { at?: Date } = {},
) {
  return invoke(
    { contract: "EventContract", fn: "recordEvent", msp: actor.msp, intent: input, at: opts.at },
    async (db) => {
      const lot = await db.lot.findUnique({ where: { id: input.lotId } });
      require_(lot, "Lot does not exist");
      require_(lot.ownerId === actor.orgId, "Only the current owner can record events for this lot");
      const allowed = MANUAL_EVENTS[lot.type as LotType] ?? [];
      require_(allowed.includes(input.type), `${EVENT_LABEL[input.type] ?? input.type} events are not valid for a ${LOT_TYPES[lot.type as LotType].label}`);
      require_(input.title?.trim(), "Event title is required");
      return {
        args: { lot: lot.code, type: input.type, data: input.data ?? {} },
        lotCode: lot.code,
        apply: async (txHash, at) =>
          db.traceEvent.create({
            data: {
              lotId: lot.id,
              type: input.type,
              title: input.title.trim(),
              data: JSON.stringify(input.data ?? {}),
              orgId: actor.orgId,
              userId: actor.userId ?? null,
              txHash,
              occurredAt: at,
            },
          }),
      };
    },
  );
}

// ─────────────────────────── CertificationContract ───────────────────────────

export async function certifyLot(
  actor: Actor,
  input: { lotId: string; standard: string; note?: string },
  opts: { at?: Date } = {},
) {
  return invoke(
    { contract: "CertificationContract", fn: "certify", msp: actor.msp, intent: input, at: opts.at },
    async (db) => {
      require_(actor.orgType === "AUDITOR" || actor.role === "ADMIN", "Only accredited auditors may certify lots");
      const lot = await db.lot.findUnique({ where: { id: input.lotId } });
      require_(lot, "Lot does not exist");
      require_(!lot.certified, `${lot.code} is already certified`);
      require_(input.standard?.trim(), "A certification standard is required");
      return {
        args: { lot: lot.code, standard: input.standard, auditor: actor.msp },
        lotCode: lot.code,
        apply: async (txHash, at) => {
          await db.lot.update({ where: { id: lot.id }, data: { certified: true } });
          return db.traceEvent.create({
            data: {
              lotId: lot.id,
              type: "CERTIFIED",
              title: `Certified — ${input.standard}`,
              data: JSON.stringify({ standard: input.standard, note: input.note ?? "" }),
              orgId: actor.orgId,
              userId: actor.userId ?? null,
              txHash,
              occurredAt: at,
            },
          });
        },
      };
    },
  );
}

// ─────────────────────────── DocumentContract ───────────────────────────

export async function anchorDocument(
  actor: Actor,
  input: { lotId?: string | null; name: string; kind: string; sha256: string; size: number; mimeType: string; storagePath: string },
  opts: { at?: Date } = {},
) {
  return invoke(
    { contract: "DocumentContract", fn: "anchorDocument", msp: actor.msp, intent: { name: input.name, sha256: input.sha256 }, at: opts.at },
    async (db) => {
      require_(/^[a-f0-9]{64}$/.test(input.sha256), "Invalid SHA-256 digest");
      let lotCode: string | undefined;
      if (input.lotId) {
        const lot = await db.lot.findUnique({ where: { id: input.lotId } });
        require_(lot, "Lot does not exist");
        require_(
          lot.ownerId === actor.orgId || lot.creatorId === actor.orgId || actor.orgType === "AUDITOR" || actor.role === "ADMIN",
          "Only the owner, creator or an auditor can attach documents to this lot",
        );
        lotCode = lot.code;
      }
      return {
        args: { document: input.name, kind: input.kind, sha256: input.sha256, size: input.size, lot: lotCode ?? null },
        lotCode,
        apply: async (txHash, at) => {
          const doc = await db.document.create({
            data: {
              name: input.name,
              kind: input.kind,
              mimeType: input.mimeType,
              size: input.size,
              sha256: input.sha256,
              storagePath: input.storagePath,
              txHash,
              lotId: input.lotId ?? null,
              orgId: actor.orgId,
              uploadedById: actor.userId ?? null,
              createdAt: at,
            },
          });
          if (input.lotId)
            await db.traceEvent.create({
              data: {
                lotId: input.lotId,
                type: "DOCUMENT_ANCHORED",
                title: `${input.kind.replace("_", " ").toLowerCase()} anchored — ${input.name}`,
                data: JSON.stringify({ sha256: input.sha256, documentId: doc.id }),
                orgId: actor.orgId,
                userId: actor.userId ?? null,
                txHash,
                occurredAt: at,
              },
            });
          return doc;
        },
      };
    },
  );
}

// ─────────────────────────── SensorContract ───────────────────────────

export async function anchorSensorBatch(
  actor: Actor,
  input: { deviceCode: string; count: number; merkleRoot: string; from: Date; to: Date },
  opts: { at?: Date } = {},
) {
  return invoke(
    { contract: "SensorContract", fn: "anchorReadings", msp: actor.msp, intent: { device: input.deviceCode }, at: opts.at },
    async (db) => {
      const device = await db.device.findUnique({ where: { code: input.deviceCode } });
      require_(device, "Device is not registered");
      require_(device.orgId === actor.orgId || actor.role === "ADMIN", "Device belongs to another organisation");
      require_(input.count > 0, "No readings to anchor");
      return {
        args: { device: device.code, readings: input.count, merkleRoot: input.merkleRoot, from: input.from.toISOString(), to: input.to.toISOString() },
        apply: async () => ({ device: device.code }),
      };
    },
  );
}

// ─────────────────────────── PassportContract ───────────────────────────

export type PassportInput = {
  lotId: string;
  productName: string;
  style: string;
  colorName: string;
  colorHex: string;
  sizes: string;
  description: string;
  care: string[];
  endOfLife: string;
};

export async function publishPassport(actor: Actor, input: PassportInput, opts: { at?: Date; publicId?: string } = {}) {
  return invoke(
    { contract: "PassportContract", fn: "publishPassport", msp: actor.msp, intent: { lotId: input.lotId }, at: opts.at },
    async (db) => {
      const lot = await db.lot.findUnique({ where: { id: input.lotId }, include: { passport: true } });
      require_(lot, "Lot does not exist");
      require_(lot.type === "GARMENT_BATCH", "Passports can only be issued for garment batches");
      require_(lot.ownerId === actor.orgId, "Only the current owner of the garments can publish their passport");
      require_(actor.orgType === "BRAND" || actor.orgType === "GARMENT_FACTORY", "Only brands or garment factories can publish passports");
      require_(input.productName?.trim(), "Product name is required");
      const publicId =
        lot.passport?.publicId ?? opts.publicId ?? `DPP-${lot.code.split("-").slice(-1)[0]}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      return {
        args: { lot: lot.code, passport: publicId, product: input.productName, brand: actor.msp },
        lotCode: lot.code,
        apply: async (txHash, at) => {
          const data = {
            productName: input.productName.trim(),
            style: input.style,
            colorName: input.colorName,
            colorHex: input.colorHex,
            sizes: input.sizes,
            description: input.description,
            care: JSON.stringify(input.care),
            endOfLife: input.endOfLife,
            published: true,
            txHash,
          };
          const passport = await db.passport.upsert({
            where: { lotId: lot.id },
            create: { ...data, lotId: lot.id, publicId, createdAt: at },
            update: data,
          });
          await db.traceEvent.create({
            data: {
              lotId: lot.id,
              type: "PASSPORT_PUBLISHED",
              title: `Digital Product Passport ${publicId} published`,
              data: JSON.stringify({ publicId }),
              orgId: actor.orgId,
              userId: actor.userId ?? null,
              txHash,
              occurredAt: at,
            },
          });
          return passport;
        },
      };
    },
  );
}

export function attrsOf(lot: { attributes: string }) {
  return safeJson<Record<string, unknown>>(lot.attributes);
}
