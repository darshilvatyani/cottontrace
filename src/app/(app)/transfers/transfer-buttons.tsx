"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { respondTransferAction } from "@/app/actions/transfers";
import { Button } from "@/components/ui";

export function TransferButtons({ id, direction }: { id: string; direction: "in" | "out" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (action: "ACCEPT" | "REJECT" | "CANCEL") =>
    start(async () => {
      const res = await respondTransferAction(id, action);
      if (!res.ok) {
        toast.error("Rejected by smart contract", { description: res.error });
        return;
      }
      toast.success(action === "ACCEPT" ? "Material received — ownership transferred" : action === "REJECT" ? "Shipment rejected" : "Shipment cancelled", {
        description: `Block #${res.data.blockNumber}`,
      });
      router.refresh();
    });

  if (direction === "out")
    return (
      <Button variant="outline" disabled={pending} onClick={() => act("CANCEL")} className="h-9">
        <X size={14} /> Recall
      </Button>
    );
  return (
    <div className="flex gap-2">
      <Button variant="outline" disabled={pending} onClick={() => act("REJECT")} className="h-9">
        <X size={14} /> Reject
      </Button>
      <Button disabled={pending} onClick={() => act("ACCEPT")} className="h-9">
        <Check size={14} /> Accept & sign
      </Button>
    </div>
  );
}
