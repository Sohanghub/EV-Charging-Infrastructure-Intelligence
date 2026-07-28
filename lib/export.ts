import {
  CAPACITY_UTILISATION,
  DAILY_KWH,
  HOURS_PER_DAY,
} from "./constants.ts";
import { displayMetric, type MetricDef } from "./metrics.ts";
import type { ScoredCity } from "./types.ts";

/**
 * JSON export of what a chart actually drew.
 *
 * Nothing on Explore is a static file. Every figure comes out of `scoreCity`
 * against the live slider values, so six of the nine derived fields — demand,
 * deficit, ratio, priority, severity, crossover — move as the sliders move.
 * Two exports of the same chart at different slider positions differ in their
 * numbers, their severity bands and even the membership of the top ten. An
 * export that records only rows is therefore unfalsifiable: it looks
 * authoritative and cannot be reproduced.
 *
 * So every payload carries the parameters that produced it. `params` is the
 * live UI state; `model` is the fixed duty-cycle and utilisation assumptions,
 * which change only when the code does but are what the numbers mean.
 */

export interface ExportEnvelope<Row> {
  generated_at: string;
  /** Slug identifying which chart. Also becomes the filename. */
  chart: string;
  /** Live UI state the rows were derived under. */
  params: Record<string, unknown>;
  /** Fixed model assumptions, for reading the units. */
  model: {
    daily_kwh: typeof DAILY_KWH;
    capacity_utilisation: number;
    hours_per_day: number;
  };
  rows: Row[];
}

export function buildExport<Row>(
  chart: string,
  params: Record<string, unknown>,
  rows: Row[]
): ExportEnvelope<Row> {
  return {
    generated_at: new Date().toISOString(),
    chart,
    params,
    model: {
      daily_kwh: DAILY_KWH,
      capacity_utilisation: CAPACITY_UTILISATION,
      hours_per_day: HOURS_PER_DAY,
    },
    rows,
  };
}

/** The scatter: fleet size against coverage, coloured by severity. */
export const coverageRows = (cities: readonly ScoredCity[]) =>
  cities.map((c) => ({
    id: c.id,
    city: c.city,
    state: c.state,
    registered_ev: c.registered_ev,
    chargers_per_1000_ev: c.chargers_per_1000_ev,
    deficit_kwh_day: c.deficit_kwh_day,
    severity: c.severity,
  }));

/**
 * The ranked bar chart. `metric.value` is an accessor passed to Recharts as a
 * `dataKey` function, so the plotted number is computed at render and never
 * written to the city — `JSON.stringify` alone would not find it. It is emitted
 * here explicitly, alongside the label, because for `growth_score` the two are
 * computed from different fields: the bar is the clamped 0–1 score and the
 * tooltip is the raw growth rate. They diverge on the four cities whose fleets
 * are shrinking, where the bar reads 0 and the label reads negative.
 *
 * ponytail: `deficit_ratio` is Infinity for a city with no installed capacity,
 * which serialises to null. No such city exists in the dataset today; null
 * reads correctly as "no capacity" if one ever appears.
 */
export const metricRows = (cities: readonly ScoredCity[], metric: MetricDef) =>
  cities.map((c) => ({
    id: c.id,
    city: c.city,
    state: c.state,
    value: metric.value(c),
    display: displayMetric(metric, c),
  }));
