import { MAX_GROWTH_RATE } from "./constants.ts";
import { formatCompact, formatDecimal, formatPercent } from "./format.ts";
import { clamp } from "./scoring.ts";
import type { ScoredCity, StateAggregate } from "./types.ts";

/**
 * One definition per metric, shared by the Explore selector, the map colouring,
 * the charts and the comparison table. Adding a metric here adds it everywhere.
 */

export type MetricKey =
  | "priority_score"
  | "deficit_ratio"
  | "demand_kwh_day"
  | "supply_kwh_day"
  | "chargers_per_1000_ev"
  | "growth_score"
  | "registered_ev";

export interface MetricDef {
  key: MetricKey;
  label: string;
  /** Column header — short enough for a dense table. */
  short: string;
  description: string;
  /** The number used for colour, size and sorting. */
  value: (c: ScoredCity) => number;
  /** State-level equivalent, for the boundary choropleth. */
  stateValue: (s: StateAggregate) => number;
  format: (value: number) => string;
  /** Overrides `format` when the displayed number differs from the ranked one. */
  display?: (c: ScoredCity) => string;
  /** True when a high value means "needs investment". Drives the colour ramp. */
  higherIsWorse: boolean;
}

export const METRICS: Record<MetricKey, MetricDef> = {
  priority_score: {
    key: "priority_score",
    label: "Energy deficit",
    short: "Deficit",
    description:
      "Public charging energy demanded but not deliverable, in kWh per day. This is the ranking.",
    value: (c) => c.priority_score,
    stateValue: (s) => s.priority_score,
    format: (v) => `${formatCompact(v)} kWh`,
    higherIsWorse: true,
  },
  deficit_ratio: {
    key: "deficit_ratio",
    label: "Demand vs supply",
    short: "Ratio",
    description:
      "Demand as a multiple of installed capacity. 1.0 is break-even; above 2.0 is critical.",
    value: (c) => c.deficit_ratio,
    stateValue: (s) => s.deficit_ratio,
    format: (v) => `${formatDecimal(v, 2)}x`,
    higherIsWorse: true,
  },
  demand_kwh_day: {
    key: "demand_kwh_day",
    label: "Public charging demand",
    short: "Demand",
    description:
      "Energy the city's fleet draws from public points per day. Three-wheelers dominate it.",
    value: (c) => c.demand_kwh_day,
    stateValue: (s) => s.demand_kwh_day,
    format: (v) => `${formatCompact(v)} kWh`,
    higherIsWorse: true,
  },
  supply_kwh_day: {
    key: "supply_kwh_day",
    label: "Deliverable supply",
    short: "Supply",
    description: "Energy installed capacity can deliver per day at the assumed utilisation.",
    value: (c) => c.supply_kwh_day,
    stateValue: (s) => s.supply_kwh_day,
    format: (v) => `${formatCompact(v)} kWh`,
    higherIsWorse: false,
  },
  chargers_per_1000_ev: {
    key: "chargers_per_1000_ev",
    label: "Chargers per 1,000 EVs",
    short: "Per 1k EVs",
    description:
      "Retained for context only. Counting vehicles rather than energy is what reported a national surplus where the energy model reports a deficit.",
    value: (c) => c.chargers_per_1000_ev,
    stateValue: (s) => s.chargers_per_1000_ev,
    format: (v) => formatDecimal(v, 1),
    higherIsWorse: false,
  },
  growth_score: {
    key: "growth_score",
    label: "EV growth (YoY)",
    short: "Growth",
    description: `Year-on-year growth in registered EVs, scored against a ${formatPercent(MAX_GROWTH_RATE)} ceiling.`,
    value: (c) => c.growth_score,
    stateValue: (s) => clamp(s.ev_growth_rate / MAX_GROWTH_RATE, 0, 1),
    format: (v) => formatPercent(v * MAX_GROWTH_RATE),
    display: (c) => formatPercent(c.ev_growth_rate),
    higherIsWorse: true,
  },
  registered_ev: {
    key: "registered_ev",
    label: "Registered EVs",
    short: "EVs",
    description: "Total registered electric vehicles, all classes.",
    value: (c) => c.registered_ev,
    stateValue: (s) => s.registered_ev,
    format: formatCompact,
    higherIsWorse: true,
  },
};

export const METRIC_LIST: MetricDef[] = Object.values(METRICS);

export const displayMetric = (metric: MetricDef, city: ScoredCity) =>
  metric.display ? metric.display(city) : metric.format(metric.value(city));
