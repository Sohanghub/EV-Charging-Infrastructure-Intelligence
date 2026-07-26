import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const TONE_CLASS = {
  neutral: "text-foreground",
  demand: "text-chart-1",
  infrastructure: "text-chart-2",
  warning: "text-chart-3",
  critical: "text-chart-4",
} as const;

interface KPICardProps {
  label: string;
  value: React.ReactNode;
  /** Unit or qualifier shown next to the value, e.g. "per 1,000 EVs". */
  unit?: string;
  /** One line of context under the value. */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof TONE_CLASS;
  className?: string;
}

export function KPICard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        {Icon ? (
          <Icon className={cn("size-4 shrink-0", TONE_CLASS[tone])} aria-hidden />
        ) : null}
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            TONE_CLASS[tone]
          )}
        >
          {value}
        </span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
