"use client";

import dynamic from "next/dynamic";

const Inner = dynamic(() => import("./garment-3d-inner"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <div className="size-16 animate-spin rounded-full border-2 border-dashed border-current opacity-40" />
    </div>
  ),
});

export function Garment3D({ color }: { color: string }) {
  return <Inner color={color} />;
}
