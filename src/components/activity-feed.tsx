import Link from "next/link";
import { EVENT_LABEL } from "@/lib/domain";
import { timeAgo } from "@/lib/utils";
import { LotIcon } from "./stage-icon";

export type FeedEvent = {
  id: string;
  type: string;
  title: string;
  occurredAt: Date;
  txHash: string | null;
  org: { name: string };
  lot: { code: string; type: string };
};

const EVENT_TONE: Record<string, string> = {
  CERTIFIED: "#0f6b63",
  TRANSFER_SENT: "#d6a021",
  TRANSFER_RECEIVED: "#56733a",
  QUALITY_TEST: "#25337a",
  DOCUMENT_ANCHORED: "#5a3a7a",
  PASSPORT_PUBLISHED: "#1c1a16",
  SPLIT: "#b5652b",
};

export function ActivityFeed({ events }: { events: FeedEvent[] }) {
  return (
    <ol className="relative">
      <span className="absolute bottom-3 left-[19px] top-3 border-l border-dashed border-line" />
      {events.map((e) => (
        <li key={e.id} className="relative flex gap-3 py-2.5">
          <span
            className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-2 border-card bg-paper-2"
            style={{ color: EVENT_TONE[e.type] ?? "#4a453c" }}
          >
            <LotIcon type={e.lot.type} size={17} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="truncate text-sm font-semibold text-ink">{e.title}</div>
              <div className="shrink-0 font-mono text-[10px] text-muted">{timeAgo(e.occurredAt)}</div>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: EVENT_TONE[e.type] }}>
                {EVENT_LABEL[e.type] ?? e.type}
              </span>
              <span>·</span>
              <Link href={`/lots/${e.lot.code}`} className="font-mono text-[11px] text-ink-2 hover:text-indigo hover:underline">
                {e.lot.code}
              </Link>
              <span>·</span>
              <span className="truncate">{e.org.name}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
