"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ExportEnvelope } from "@/lib/export";

/**
 * Downloads a chart's payload as JSON. The payload is a thunk so it is built on
 * click rather than on every render — the rows are live-derived and rebuilding
 * them behind every slider move would be wasted work.
 */
export function ExportButton({
  payload,
  label = "Download chart data as JSON",
}: {
  payload: () => ExportEnvelope<unknown>;
  label?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="xs"
      aria-label={label}
      title={label}
      className="text-muted-foreground"
      onClick={() => {
        const data = payload();
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `evip-${data.chart}-${data.generated_at.slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download />
      JSON
    </Button>
  );
}
