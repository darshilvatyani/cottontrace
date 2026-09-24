"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { Button, Input, Label, Kicker } from "@/components/ui";
import { OrgIcon, Logo } from "@/components/stage-icon";

const DEMO = [
  { email: "farmer@cottontrace.dev", role: "Farmer", org: "Shivam Organic Farm", type: "FARM" },
  { email: "gin@cottontrace.dev", role: "Ginner", org: "Kadi Ginning", type: "GIN" },
  { email: "spinner@cottontrace.dev", role: "Spinner", org: "Kovai Spinning", type: "SPINNING_MILL" },
  { email: "weaver@cottontrace.dev", role: "Knitter", org: "Noyyal Knit", type: "WEAVING_UNIT" },
  { email: "dyer@cottontrace.dev", role: "Dyer", org: "Bhavani Dye House", type: "DYEING_UNIT" },
  { email: "factory@cottontrace.dev", role: "Manufacturer", org: "Garden City Apparel", type: "GARMENT_FACTORY" },
  { email: "brand@cottontrace.dev", role: "Brand", org: "Kapas & Co.", type: "BRAND" },
  { email: "auditor@cottontrace.dev", role: "Auditor", org: "IndiCert", type: "AUDITOR" },
  { email: "farmer2@cottontrace.dev", role: "Farmer B", org: "Vidarbha Growers", type: "FARM" },
  { email: "admin@cottontrace.dev", role: "Admin", org: "Consortium", type: "AUDITOR" },
];

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function login(e: string, p: string) {
    setBusy(e);
    const { error } = await signIn.email({ email: e, password: p });
    setBusy(null);
    if (error) return toast.error(error.message ?? "Could not sign in");
    router.push(next);
    router.refresh();
  }

  return (
    <div>
      <Link href="/" className="mb-10 flex items-center gap-2 lg:hidden">
        <Logo size={30} /> <span className="font-display text-xl">CottonTrace</span>
      </Link>
      <Kicker>Welcome back</Kicker>
      <h1 className="mt-2 font-display text-5xl tracking-tight">Sign in</h1>
      <p className="mt-2 text-ink-2">
        New to the network? <Link href="/sign-up" className="font-semibold text-indigo underline-offset-4 hover:underline">Create an account</Link>
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          login(email, password);
        }}
      >
        <div>
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={!!busy}>
          {busy === email ? "Signing in…" : "Sign in"} <ArrowRight size={15} />
        </Button>
      </form>

      <div className="my-8 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 border-t border-dashed border-line" />
        or step into a demo role · password <code className="font-mono">cotton123</code>
        <span className="h-px flex-1 border-t border-dashed border-line" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {DEMO.map((d) => (
          <button
            key={d.email}
            onClick={() => login(d.email, "cotton123")}
            disabled={!!busy}
            className="group flex items-center gap-3 rounded-xl border border-line bg-card p-2.5 text-left transition hover:-translate-y-0.5 hover:border-ink-2 disabled:opacity-60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-paper-2 text-ink-2 group-hover:bg-turmeric group-hover:text-ink">
              <OrgIcon type={d.type} size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{busy === d.email ? "Signing in…" : d.role}</span>
              <span className="block truncate text-[11px] text-muted">{d.org}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
