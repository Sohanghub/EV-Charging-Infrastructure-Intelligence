"use client";

/** Recharts' default tooltip ignores the theme. This one uses the popover tokens. */
export function ChartTooltip({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{title}</p>
      {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
      <dl className="mt-1.5 space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            {row.color ? (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
            ) : null}
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="ml-auto font-medium tabular-nums text-popover-foreground">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Axis and grid styling shared by every chart. */
export const AXIS_PROPS = {
  stroke: "var(--muted-foreground)",
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
  tickLine: false,
  axisLine: false,
} as const;

export const GRID_PROPS = {
  stroke: "var(--border)",
  strokeDasharray: "3 3",
  vertical: false,
} as const;
