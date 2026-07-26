"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { SeverityBadge } from "@/components/severity-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { displayMetric, METRICS, type MetricKey } from "@/lib/metrics";
import type { ScoredCity } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Numeric columns are the metric registry, so labels and formats never diverge. */
const METRIC_COLUMNS: MetricKey[] = [
  "registered_ev",
  "chargers_per_1000_ev",
  "demand_kwh_day",
  "supply_kwh_day",
  "deficit_ratio",
  "priority_score",
];

type SortKey = "city" | "state" | "severity" | MetricKey;

const SEVERITY_ORDER = { strong: 0, moderate: 1, critical: 2 } as const;

const sortValue = (city: ScoredCity, key: SortKey): number | string => {
  if (key === "city") return city.city;
  if (key === "state") return city.state;
  if (key === "severity") return SEVERITY_ORDER[city.severity];
  return METRICS[key].value(city);
};

export function ComparisonTable({
  cities,
  onSelect,
  selectedId,
}: {
  cities: readonly ScoredCity[];
  onSelect: (city: ScoredCity) => void;
  selectedId?: string | null;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "priority_score",
    desc: true,
  });

  const rows = useMemo(() => {
    const direction = sort.desc ? -1 : 1;
    return [...cities].sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      const delta =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : Number(left) - Number(right);
      // Ties fall back to city name so the order never shuffles between renders.
      return delta * direction || a.city.localeCompare(b.city);
    });
  }, [cities, sort]);

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : // Text sorts read better ascending; numbers read better worst-first.
          { key, desc: key !== "city" && key !== "state" }
    );

  return (
    <div
      className={cn(
        "rounded-lg border border-border",
        "[&_[data-slot=table-container]]:max-h-[34rem] [&_[data-slot=table-container]]:overflow-y-auto"
      )}
    >
      <Table>
        <caption className="sr-only">
          Cities compared by demand, supply and priority. Column headers sort the table.
        </caption>
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
          <TableRow>
            <SortableHead label="City" sortKey="city" sort={sort} onToggle={toggle} />
            <SortableHead label="State" sortKey="state" sort={sort} onToggle={toggle} />
            <SortableHead
              label="Coverage"
              sortKey="severity"
              sort={sort}
              onToggle={toggle}
            />
            {METRIC_COLUMNS.map((key) => (
              <SortableHead
                key={key}
                label={METRICS[key].short}
                title={METRICS[key].label}
                sortKey={key}
                sort={sort}
                onToggle={toggle}
                numeric
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((city) => (
            <TableRow
              key={city.id}
              data-state={city.id === selectedId ? "selected" : undefined}
              className="cursor-pointer data-[state=selected]:bg-accent"
              onClick={() => onSelect(city)}
            >
              <TableCell className="font-medium">
                <button
                  type="button"
                  className="rounded-sm text-left underline-offset-4 hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(city);
                  }}
                >
                  {city.city}
                </button>
              </TableCell>
              <TableCell className="text-muted-foreground">{city.state}</TableCell>
              <TableCell>
                <SeverityBadge severity={city.severity} />
              </TableCell>
              {METRIC_COLUMNS.map((key) => (
                <TableCell key={key} data-numeric>
                  {displayMetric(METRICS[key], city)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3 + METRIC_COLUMNS.length}
                className="py-10 text-center text-muted-foreground"
              >
                No cities match these filters.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {formatNumber(rows.length)} cities · select a row for the full profile
      </p>
    </div>
  );
}

function SortableHead({
  label,
  title,
  sortKey,
  sort,
  onToggle,
  numeric,
}: {
  label: string;
  title?: string;
  sortKey: SortKey;
  sort: { key: SortKey; desc: boolean };
  onToggle: (key: SortKey) => void;
  numeric?: boolean;
}) {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.desc ? ArrowDown : ArrowUp) : ChevronsUpDown;

  return (
    <TableHead
      data-numeric={numeric || undefined}
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
      className="whitespace-nowrap"
    >
      <button
        type="button"
        title={title}
        onClick={() => onToggle(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground",
          numeric && "flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className="size-3 shrink-0" aria-hidden />
      </button>
    </TableHead>
  );
}
