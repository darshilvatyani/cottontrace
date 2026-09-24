# CottonTrace — Seed-to-Cloth Traceability

The software part of the **Cotton Seed-to-Cloth Production** major project: a blockchain-enabled traceability
platform with IoT, AI anomaly detection, GIS maps, 3D graphics and Digital Product Passports.

```
Farm A → Gin A → Spinning Mill A → Knitting A → Dye House A → Garment Factory A → Brand A
```

## Quick start

Requires Node.js 20+. No external database or services are needed; the app uses SQLite.

```bash
npm install
npm run setup      # generate Prisma client, create the SQLite DB, seed the demo chain
npm run dev        # http://localhost:3000
```

Every demo account uses the password **`cotton123`**. The sign-in page has one-click role buttons.

| Role | Email | Organisation |
|---|---|---|
| Farmer | farmer@cottontrace.dev | Shivam Organic Farm, Rajkot |
| Farmer B | farmer2@cottontrace.dev | Vidarbha Growers Collective, Yavatmal |
| Ginner | gin@cottontrace.dev | Kadi Ginning & Pressing Co. |
| Spinner | spinner@cottontrace.dev | Kovai Spinning Mills, Coimbatore |
| Knitter | weaver@cottontrace.dev | Noyyal Knit Fabrics, Tiruppur |
| Dyer | dyer@cottontrace.dev | Bhavani Natural Dye House, Erode |
| Manufacturer | factory@cottontrace.dev | Garden City Apparel, Bengaluru |
| Brand | brand@cottontrace.dev | Kapas & Co., Mumbai |
| Auditor | auditor@cottontrace.dev | IndiCert Textile Assurance |
| Admin | admin@cottontrace.dev | CottonTrace Consortium |

Public passport (no login): **http://localhost:3000/p/KAPAS-TEE-001**

`npm run db:reset` rebuilds the demo from scratch.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, Turbopack), React 19, TypeScript |
| Auth | Better Auth (email + password, Prisma adapter, role and organisation on the user) |
| Database | Prisma 7 + SQLite (`better-sqlite3` driver adapter) |
| Ledger | Custom permissioned ledger modelled on Hyperledger Fabric (`src/lib/chain`) |
| Styling | Tailwind CSS v4, Fraunces / Hanken Grotesk / JetBrains Mono |
| Graphics | React Three Fiber (3D garment), Motion (fibre→garment animation), custom SVG genealogy graph |
| Maps / charts | Leaflet + react-leaflet (Esri basemap), Recharts |
| Other | `qrcode` (QR SVGs), Zod (validation), Sonner (toasts) |

## How the report maps to the code

| Report section | Implementation |
|---|---|
| Digital identities for lots | `Lot` model with 8 types (seed → garment); codes like `BALE-2026-0001` |
| Parent → child relationships (split, mix, transform) | `LotLink`. Partial handoffs split a lot into a linked child (`…-S1`) |
| Permissioned blockchain | `src/lib/chain/ledger.ts`: SHA-256 transaction hashes, Merkle roots, hash-linked blocks, per-org MSP identities, full-chain verification |
| Smart contracts | `src/lib/chain/contracts.ts`: `LotContract`, `TransferContract`, `EventContract`, `CertificationContract`, `DocumentContract`, `SensorContract`, `PassportContract`. They enforce existence, ownership, quantity, role and **mass balance** (e.g. a bale can't exceed 45% of seed-cotton input). Rejected invocations are logged. |
| Off-chain documents + hash verification | `storage/documents/` holds the files; only the SHA-256 goes on-chain. **Documents → Tamper** shows the mismatch. |
| IoT (ESP32 / Raspberry Pi, MQTT) | Device registry, `POST /api/iot/ingest` with a per-device key, range validation, Merkle-anchoring of reading batches, simulator |
| AI / analytics | `src/lib/ai/detector.ts`: robust z-scores (median/MAD) with a logistic score, plus domain rules. Findings go to an auditor review queue. |
| QR + Digital Product Passport | `/p/[id]` (public), `/api/qr/[id]`, printable hang tag at `/tag/[id]`, camera scanner at `/scan` |
| Multimedia / CG | WebGL 3D tee dyed in the passport's shade, animated fibre→yarn→fabric→garment story, interactive material-flow graph, GIS route maps, infographics |
| Role-based dashboards | Each organisation type sees its own actions, stock, handoffs and flags. Auditors, brands and admin get network-wide views. |

## Demo script (≈5 minutes)

1. **Passport:** open `/p/KAPAS-TEE-001`. Show the 3D tee, the "Authentic & verified" check (every lot is re-verified against the ledger), per-piece water/energy/CO₂, the journey and the map.
2. **Genealogy:** sign in as the Brand, then open `GAR-2026-0001-S1` and trace the ribbons back to two harvest lots and two seed lots.
3. **Smart contracts:** as the Farmer, hand off `HRV-2026-0005` with a quantity larger than what's available. The contract rejects it, and the rejection appears in **Ledger → Rejected invocations**.
4. **Handoff and transformation:** as the Ginner, accept the pending shipment, then **Transform → Cotton Bale**. The live gauge shows the ginning outturn against the 35% expected and 45% cap.
5. **Tamper evidence:** as the Admin, go to **Ledger → Simulate tampering → Verify chain**. The broken hash is reported; click **Restore**. As the Auditor, go to **Documents → Tamper → Verify stored**.
6. **AI:** as the Auditor, open **AI Insights**. The engine flags an impossible 43% ginning outturn, a harvest above field productivity, a duplicate seed registration, Farm A's organic certificate reused by Farm B, a stale shipment and sensor spikes. Confirm or dismiss them.
7. **IoT:** as the Farmer, go to **IoT Sensors → Inject an anomalous spike**, then re-run the AI scan.

### Posting from a real device

```bash
curl -X POST http://localhost:3000/api/iot/ingest \
  -H "content-type: application/json" \
  -H "x-device-key: ctk_demo_esp_farma_001" \
  -d '{"readings":[{"metric":"SOIL_MOISTURE","value":31.5},{"metric":"TEMPERATURE","value":29.2}]}'
```

## Project structure

```
prisma/schema.prisma      data model (auth, network, lots, ledger, IoT, AI, passports)
prisma/seed.ts            full demo chain built through the real contracts
src/lib/chain/            ledger engine + smart contracts
src/lib/ai/detector.ts    anomaly detection
src/lib/trace.ts          genealogy traversal, journey & sustainability allocation
src/app/(app)/            authenticated console (dashboard, lots, handoffs, ledger, documents, IoT, insights, map, passports, network)
src/app/p/[publicId]/     public Digital Product Passport
src/app/actions/          server actions (validate with Zod → invoke contract)
```

## Notes and limitations

- The ledger runs in-process to keep the prototype self-contained. The contract/ledger boundary (`invoke()`) is where a Hyperledger Fabric gateway client would plug in.
- To use PostgreSQL instead of SQLite, change `provider` in `schema.prisma` and swap `PrismaBetterSqlite3` for `@prisma/adapter-pg` in `src/lib/prisma.ts`.
- As the report notes, the ledger proves records weren't altered after the fact; it can't prove the original real-world data was true. That's the job of the auditor workflow and the AI flags.
