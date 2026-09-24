"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { signUp } from "@/lib/auth-client";
import { Button, Input, Label, Kicker } from "@/components/ui";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await signUp.email(form);
    setBusy(false);
    if (error) return toast.error(error.message ?? "Could not create account");
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div>
      <Kicker>Join the cotton-channel</Kicker>
      <h1 className="mt-2 font-display text-5xl tracking-tight">Create account</h1>
      <p className="mt-2 text-ink-2">
        Already a member? <Link href="/sign-in" className="font-semibold text-indigo underline-offset-4 hover:underline">Sign in</Link>
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <Label>Full name</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ramesh Patel" />
        </div>
        <div>
          <Label>Work email</Label>
          <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@farm.in" />
        </div>
        <div>
          <Label hint="min. 8 characters">Password</Label>
          <Input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy ? "Creating…" : "Continue"} <ArrowRight size={15} />
        </Button>
        <p className="text-xs leading-relaxed text-muted">
          Next you&apos;ll register or join an organisation. Your organisation type determines your role and which
          smart-contract functions you may invoke.
        </p>
      </form>
    </div>
  );
}
