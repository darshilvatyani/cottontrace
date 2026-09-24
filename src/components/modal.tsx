"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, kicker, children }: { open: boolean; onClose: () => void; title: string; kicker?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-card shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between border-b border-dashed border-line px-6 py-5">
          <div>
            {kicker && <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{kicker}</div>}
            <h3 className="font-display text-2xl">{title}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
