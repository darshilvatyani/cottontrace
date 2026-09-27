"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Blocks,
  Cpu,
  FileText,
  LayoutGrid,
  LogOut,
  Map,
  Menu,
  Network,
  QrCode,
  Sparkles,
  Tags,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Logo, OrgIcon } from "./stage-icon";

type NavItem = { href: string; label: string; icon: typeof LayoutGrid; badge?: number };

export function AppShell({
  children,
  user,
  chain,
  pendingIncoming,
  openAnomalies,
}: {
  children: ReactNode;
  user: { name: string; email: string; role: string; roleLabel: string; org: { name: string; type: string; typeLabel: string; code: string } };
  chain: { height: number; head: string };
  pendingIncoming: number;
  openAnomalies: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: "Material",
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutGrid },
        { href: "/lots", label: "Lots & Genealogy", icon: Tags },
        { href: "/transfers", label: "Handoffs", icon: ArrowLeftRight, badge: pendingIncoming },
        { href: "/map", label: "Supply Map", icon: Map },
      ],
    },
    {
      title: "Trust",
      items: [
        { href: "/ledger", label: "Ledger Explorer", icon: Blocks },
        { href: "/documents", label: "Documents", icon: FileText },
        { href: "/iot", label: "IoT Sensors", icon: Cpu },
        { href: "/insights", label: "AI Insights", icon: Sparkles, badge: ["AUDITOR", "ADMIN"].includes(user.role) ? openAnomalies : 0 },
      ],
    },
    {
      title: "Consumers",
      items: [
        { href: "/passports", label: "Product Passports", icon: QrCode },
        { href: "/network", label: "Network", icon: Network },
      ],
    },
  ];

  async function logout() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const sidebar = (
    <div className="weave flex h-full flex-col text-paper">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Logo size={34} />
          <div>
            <div className="font-display text-xl leading-none tracking-tight">CottonTrace</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-paper/50">seed → cloth ledger</div>
          </div>
        </Link>
        <button className="rounded-full p-2 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <div className="mx-4 mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-turmeric/90 text-ink">
            <OrgIcon type={user.org.type} size={19} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{user.org.name}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-paper/55">{user.org.typeLabel}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2 scrollbar-none">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1.5 px-3 font-mono text-[9.5px] uppercase tracking-[0.24em] text-paper/40">{g.title}</div>
            {g.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition",
                    active ? "bg-paper text-ink" : "text-paper/75 hover:bg-white/[0.06] hover:text-paper",
                  )}
                >
                  {active && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-turmeric" />}
                  <Icon size={17} strokeWidth={1.7} />
                  <span className="flex-1">{item.label}</span>
                  {!!item.badge && (
                    <span className={cn("rounded-full px-1.5 font-mono text-[10px] font-bold", active ? "bg-madder text-paper" : "bg-turmeric text-ink")}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <Link href="/ledger" onClick={() => setOpen(false)} className="mx-4 mb-3 block rounded-xl border border-dashed border-white/15 px-3 py-2.5 hover:border-white/30">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-paper/50">
          <span>cotton-channel</span>
          <span className="flex items-center gap-1 text-[#9fd8a3]">
            <span className="size-1.5 animate-pulse rounded-full bg-[#9fd8a3]" /> live
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-display text-lg">Block #{chain.height}</span>
          <span className="font-mono text-[10px] text-paper/45">{chain.head.slice(0, 8)}</span>
        </div>
      </Link>

      <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-madder font-display text-sm">
          {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{user.name}</div>
          <div className="truncate text-[11px] text-paper/55">{user.roleLabel}</div>
        </div>
        <button onClick={logout} className="rounded-full p-2 text-paper/60 hover:bg-white/10 hover:text-paper" title="Sign out">
          <LogOut size={17} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[284px] max-w-[85vw] shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/85 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-full p-2 hover:bg-paper-2" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo size={26} />
            <span className="font-display text-lg">CottonTrace</span>
          </Link>
          <span className="w-9" />
        </header>
        <main className="grain weave-light flex-1 px-4 py-8 md:px-8 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
