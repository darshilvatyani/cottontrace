"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { completeOnboardingAction } from "@/app/actions/onboarding";
import { Button, Input, Label, Select } from "@/components/ui";
import { OrgIcon } from "@/components/stage-icon";
import { ORG_TYPES, type OrgType } from "@/lib/domain";
import { PLACES } from "@/lib/places";
import { cn } from "@/lib/utils";

export function OnboardingForm({ orgs }: { orgs: { id: string; name: string; type: string; city: string }[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [orgType, setOrgType] = useState<OrgType>("FARM");
  const [orgName, setOrgName] = useState("");
  const [place, setPlace] = useState("rajkot");
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await completeOnboardingAction(mode === "create" ? { mode, orgType, orgName, place } : { mode, orgId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Welcome to the network");
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="mt-10">
      <div className="inline-flex rounded-full border border-line bg-card p-1">
        {(["create", "join"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", mode === m ? "bg-ink text-paper" : "text-ink-2")}>
            {m === "create" ? "Register a new organisation" : "Join an existing one"}
          </button>
        ))}
      </div>

      {mode === "create" ? (
        <div className="mt-8 space-y-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(Object.keys(ORG_TYPES) as OrgType[]).map((t) => {
              const d = ORG_TYPES[t];
              const active = orgType === t;
              return (
                <button
                  key={t}
                  onClick={() => setOrgType(t)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    active ? "border-ink bg-ink text-paper shadow-lg" : "border-line bg-card hover:-translate-y-0.5 hover:border-ink-2",
                  )}
                >
                  <span className={cn("grid size-10 place-items-center rounded-xl", active ? "bg-turmeric text-ink" : "bg-paper-2")} style={active ? undefined : { color: d.color }}>
                    <OrgIcon type={t} size={20} />
                  </span>
                  <div className="mt-3 font-semibold">{d.label}</div>
                  <div className={cn("mt-0.5 text-xs", active ? "text-paper/60" : "text-muted")}>{d.blurb}</div>
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Organisation name</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Saurashtra Organic Farms" />
            </div>
            <div>
              <Label>Location</Label>
              <Select value={place} onChange={(e) => setPlace(e.target.value)}>
                {PLACES.map((p) => (
                  <option key={p.key} value={p.key}>{p.city}, {p.state}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 max-w-md">
          <Label>Organisation</Label>
          <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name} — {ORG_TYPES[o.type as OrgType]?.label} · {o.city}</option>
            ))}
          </Select>
        </div>
      )}

      <Button onClick={submit} disabled={pending || (mode === "create" && orgName.trim().length < 3)} className="mt-8 h-12 px-6">
        {pending ? "Enrolling identity…" : "Enter the console"} <ArrowRight size={16} />
      </Button>
    </div>
  );
}
