import { SEVERITY_LABELS, type Severity } from "@/lib/constants";
import { cn } from "@/lib/utils";

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: "bg-chart-4/10 text-chart-4 border-chart-4/25",
  moderate: "bg-chart-3/10 text-chart-3 border-chart-3/25",
  strong: "bg-chart-2/10 text-chart-2 border-chart-2/25",
};

/** Coverage band, used identically in tables, cards and map legends. */
export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        SEVERITY_CLASS[severity],
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
