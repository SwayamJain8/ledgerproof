"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/primitives";

/**
 * Reports get printed and emailed. The print stylesheet strips the chrome, so
 * this button is genuinely useful rather than decorative.
 */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button className="no-print" onClick={() => window.print()}>
      <Printer className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
