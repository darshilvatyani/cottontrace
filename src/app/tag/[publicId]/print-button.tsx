"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function PrintButton() {
  return (
    <Button className="mt-4" onClick={() => window.print()}>
      <Printer size={15} /> Print
    </Button>
  );
}
