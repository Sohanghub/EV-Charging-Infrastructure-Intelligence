"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartFrame } from "@/components/charts/chart-frame";
import { AXIS_PROPS, ChartTooltip, GRID_PROPS } from "@/components/charts/chart-tooltip";
import { ExportButton } from "@/components/charts/export-button";
import { PALETTE } from "@/lib/constants";
import { buildExport } from "@/lib/export";
import { formatCompact, formatNumber, formatPercent } from "@/lib/format";
import type { Allocation } from "@/lib/types";

const LEGEND_PROPS = {
  wrapperStyle: { fontSize: 11, paddingTop: 4 },
  iconType: "circle",
  iconSize: 8,
} as const;

/**
 * Both charts take `stations` purely to record it in the export. The allocation
 * is a function of the slider, so rows without it cannot be reproduced.
 */
type ChartProps = { allocations: Allocation[]; stations: number };

/** Where the funded charging points land, on top of what each city already has. */
export function AllocationChart({ allocations, stations }: ChartProps) {
  const data = allocations.map((a) => ({
    id: a.city.id,
    city: a.city.city,
    state: a.city.state,
    existing: a.city.public_chargers,
    added: a.charging_points,
    stations: a.stations,
  }));

  return (
    <ChartFrame
      title="Where the charging points go"
      description="Funded points stacked on the capacity each city already has."
      height="h-[30rem]"
      action={
        <ExportButton
          payload={() =>
            buildExport("allocation", { stations, pool_size: allocations.length }, data)
          }
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
          barCategoryGap={4}
        >
          <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />
          <XAxis {...AXIS_PROPS} type="number" tickFormatter={formatCompact} />
          <YAxis {...AXIS_PROPS} type="category" dataKey="city" width={100} interval={0} />
          <Tooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
            content={({ payload }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return null;
              return (
                <ChartTooltip
                  title={row.city}
                  subtitle={row.state}
                  rows={[
                    {
                      label: "Existing points",
                      value: formatNumber(row.existing),
                      color: PALETTE.neutral,
                    },
                    {
                      label: "Funded points",
                      value: formatNumber(row.added),
                      color: PALETTE.infrastructure,
                    },
                    { label: "Stations", value: formatNumber(row.stations) },
                  ]}
                />
              );
            }}
          />
          <Legend {...LEGEND_PROPS} />
          <Bar
            dataKey="existing"
            name="Existing points"
            stackId="points"
            fill={PALETTE.neutral}
            fillOpacity={0.35}
          />
          <Bar
            dataKey="added"
            name="Funded points"
            stackId="points"
            fill={PALETTE.infrastructure}
            radius={[0, 3, 3, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** The energy shortfall in kWh/day, before and after the same investment. */
export function GapAnalysisChart({ allocations, stations }: ChartProps) {
  const data = allocations.map((a) => ({
    id: a.city.id,
    city: a.city.city,
    state: a.city.state,
    before: Math.round(Math.max(0, a.city.deficit_kwh_day)),
    after: Math.round(a.deficit_after),
    closure: a.deficit_closure,
  }));

  return (
    <ChartFrame
      title="Energy shortfall, before and after"
      description="Unmet public charging demand in kWh/day, against the same demand once the funded stations are delivering."
      height="h-[30rem]"
      action={
        <ExportButton
          payload={() =>
            buildExport("gap-analysis", { stations, pool_size: allocations.length }, data)
          }
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
          barCategoryGap={6}
          barGap={1}
        >
          <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />
          <XAxis {...AXIS_PROPS} type="number" tickFormatter={formatCompact} />
          <YAxis {...AXIS_PROPS} type="category" dataKey="city" width={100} interval={0} />
          <Tooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
            content={({ payload }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return null;
              return (
                <ChartTooltip
                  title={row.city}
                  subtitle={row.state}
                  rows={[
                    {
                      label: "Gap before",
                      value: formatNumber(row.before),
                      color: PALETTE.critical,
                    },
                    {
                      label: "Gap after",
                      value: formatNumber(row.after),
                      color: PALETTE.warning,
                    },
                    { label: "Closed", value: formatPercent(row.closure) },
                  ]}
                />
              );
            }}
          />
          <Legend {...LEGEND_PROPS} />
          <Bar
            dataKey="before"
            name="Gap before"
            fill={PALETTE.critical}
            fillOpacity={0.75}
            radius={[0, 3, 3, 0]}
          />
          <Bar
            dataKey="after"
            name="Gap after"
            fill={PALETTE.warning}
            fillOpacity={0.85}
            radius={[0, 3, 3, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
