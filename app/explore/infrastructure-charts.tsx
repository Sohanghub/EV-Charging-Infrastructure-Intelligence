"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { ChartFrame } from "@/components/charts/chart-frame";
import { AXIS_PROPS, ChartTooltip, GRID_PROPS } from "@/components/charts/chart-tooltip";
import { quantileScale } from "@/lib/color-scale";
import {
  CHARGERS_PER_1000_BENCHMARK,
  SEVERITY_COLORS,
} from "@/lib/constants";
import { formatCompact, formatDecimal, formatNumber } from "@/lib/format";
import { displayMetric, METRICS, type MetricKey } from "@/lib/metrics";
import type { ScoredCity } from "@/lib/types";

const TOP_N = 10;

export function InfrastructureCharts({
  cities,
  metric: metricKey,
  onSelect,
}: {
  cities: readonly ScoredCity[];
  metric: MetricKey;
  onSelect?: (city: ScoredCity) => void;
}) {
  const metric = METRICS[metricKey];

  const top = useMemo(
    () =>
      [...cities]
        .sort((a, b) =>
          metric.higherIsWorse
            ? metric.value(b) - metric.value(a)
            : metric.value(a) - metric.value(b)
        )
        .slice(0, TOP_N)
        .reverse(),
    [cities, metric]
  );

  const scale = useMemo(
    () => quantileScale(cities.map(metric.value), metric.higherIsWorse),
    [cities, metric]
  );

  return (
    <div className="grid gap-4">
      <ChartFrame
        title="Coverage against demand"
        description={`Every city plotted by fleet size and coverage. The line is the benchmark of ${CHARGERS_PER_1000_BENCHMARK} points per 1,000 EVs — everything below it is under-served.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis
              {...AXIS_PROPS}
              type="number"
              dataKey="registered_ev"
              name="Registered EVs"
              scale="log"
              domain={["auto", "auto"]}
              tickFormatter={formatCompact}
            />
            <YAxis
              {...AXIS_PROPS}
              type="number"
              dataKey="chargers_per_1000_ev"
              name="Per 1,000 EVs"
              width={44}
              tickFormatter={(v: number) => formatDecimal(v, 0)}
            />
            <ZAxis type="number" dataKey="capacity_gap" range={[24, 240]} />
            <ReferenceLine
              y={CHARGERS_PER_1000_BENCHMARK}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: "Benchmark",
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }}
              content={({ payload }) => {
                const city = payload?.[0]?.payload as ScoredCity | undefined;
                if (!city) return null;
                return (
                  <ChartTooltip
                    title={city.city}
                    subtitle={city.state}
                    rows={[
                      { label: "Registered EVs", value: formatNumber(city.registered_ev) },
                      {
                        label: "Per 1,000 EVs",
                        value: formatDecimal(city.chargers_per_1000_ev),
                      },
                      { label: "Energy deficit", value: `${formatNumber(Math.round(city.deficit_kwh_day))} kWh/day` },
                    ]}
                  />
                );
              }}
            />
            <Scatter
              data={cities as ScoredCity[]}
              onClick={(point) => onSelect?.(point as unknown as ScoredCity)}
              className={onSelect ? "cursor-pointer" : undefined}
            >
              {cities.map((city) => (
                <Cell
                  key={city.id}
                  fill={SEVERITY_COLORS[city.severity]}
                  fillOpacity={0.65}
                  stroke={SEVERITY_COLORS[city.severity]}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title={`Top ${Math.min(TOP_N, top.length)} cities — ${metric.label.toLowerCase()}`}
        description={metric.description}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={top as ScoredCity[]}
            layout="vertical"
            margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
            barCategoryGap={4}
          >
            <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />
            <XAxis {...AXIS_PROPS} type="number" tickFormatter={metric.format} />
            <YAxis
              {...AXIS_PROPS}
              type="category"
              dataKey="city"
              width={96}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
              content={({ payload }) => {
                const city = payload?.[0]?.payload as ScoredCity | undefined;
                if (!city) return null;
                return (
                  <ChartTooltip
                    title={city.city}
                    subtitle={city.state}
                    rows={[{ label: metric.short, value: displayMetric(metric, city) }]}
                  />
                );
              }}
            />
            <Bar
              dataKey={(c: ScoredCity) => metric.value(c)}
              radius={[0, 3, 3, 0]}
              onClick={(point) => onSelect?.(point as unknown as ScoredCity)}
              className={onSelect ? "cursor-pointer" : undefined}
            >
              {top.map((city) => (
                <Cell key={city.id} fill={scale.color(metric.value(city))} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
