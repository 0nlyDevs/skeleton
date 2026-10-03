"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog, where "Save as PDF" is one of the printers. */
export function PrintButton({ label }: { readonly label: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      <Printer aria-hidden />
      {label}
    </Button>
  );
}
