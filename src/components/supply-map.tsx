"use client";

import dynamic from "next/dynamic";
import type { MapFlow, MapNode } from "./supply-map-inner";

const Inner = dynamic(() => import("./supply-map-inner"), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[320px] place-items-center rounded-2xl bg-paper-2 font-mono text-xs text-muted">unfolding the map…</div>,
});

export function SupplyMap(props: { nodes: MapNode[]; flows: MapFlow[]; height?: number; interactive?: boolean }) {
  return <Inner {...props} />;
}
export type { MapFlow, MapNode };
