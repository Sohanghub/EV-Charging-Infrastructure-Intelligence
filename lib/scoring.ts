import {
  CAPACITY_UTILISATION,
  DAILY_KWH,
  HOURS_PER_DAY,
  MAX_GROWTH_RATE,
  NO_CROSSOVER_LABEL,
  PROJECTION_YEARS,
  PUBLIC_SHARE_DEFAULTS,
  SEVERITY_THRESHOLDS,
  VEHICLE_CLASSES,
  type Severity,
} from "./constants.ts";
import type { City, PublicShares, ScoredCity, StateAggregate } from "./types.ts";

/**
 * Pure derived metrics. No side effects, no rounding — full float precision is
 * kept internally and only `lib/format.ts` rounds for display.
 *
 * Everything here is measured in kWh/day. The application previously ranked
 * cities by charging points per registered EV, which treats an e-2W and an
 * e-bus as one unit of demand each. In a fleet that is 51% three-wheelers and
 * 45% two-wheelers that is not a simplification — it decides the answer. A
 * three-wheeler draws roughly 42x the public energy of a two-wheeler, and
 * counting vehicles reported a national surplus where counting energy reports a
 * deficit.
 */

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/* -------------------------------------------------------------------------- */
/* Demand and supply                                                          */
/* -------------------------------------------------------------------------- */

/** Public charging energy a city's fleet demands per day. */
export function demandKwhDay(c: City, shares: PublicShares = PUBLIC_SHARE_DEFAULTS): number {
  return VEHICLE_CLASSES.reduce(
    (total, klass) => total + c[klass] * DAILY_KWH[klass] * shares[klass],
    0
  );
}

/** Energy a city's installed capacity can actually deliver per day. */
export const supplyKwhDay = (c: City) => c.total_kw * HOURS_PER_DAY * CAPACITY_UTILISATION;

/** Positive means unmet demand. Negative means spare capacity. */
export const deficitKwhDay = (c: City, shares: PublicShares = PUBLIC_SHARE_DEFAULTS) =>
  demandKwhDay(c, shares) - supplyKwhDay(c);

/** Demand as a multiple of supply. 1.0 is break-even. */
export const deficitRatio = (c: City, shares: PublicShares = PUBLIC_SHARE_DEFAULTS) => {
  const supply = supplyKwhDay(c);
  return supply > 0 ? demandKwhDay(c, shares) / supply : Infinity;
};

/* -------------------------------------------------------------------------- */
/* Projection                                                                 */
/* -------------------------------------------------------------------------- */

/** Demand `years` from now, compounding the real Vahan growth rate. */
export const projectedDemandKwh = (
  c: City,
  years: number,
  shares: PublicShares = PUBLIC_SHARE_DEFAULTS
) => demandKwhDay(c, shares) * (1 + c.ev_growth_rate) ** years;

/**
 * Whole years until demand overtakes supply, or `null` if it never does.
 *
 * A city already short returns 0. A city whose fleet is shrinking returns null,
 * which is a finding rather than missing data — growth used to be a multiplicand
 * in the priority score, where a negative rate inverted the ranking and a
 * near-zero rate annihilated a genuine deficit. Here it can do neither.
 */
export function crossoverYear(
  c: City,
  shares: PublicShares = PUBLIC_SHARE_DEFAULTS,
  horizon: number = PROJECTION_YEARS
): number | null {
  const supply = supplyKwhDay(c);
  if (demandKwhDay(c, shares) >= supply) return 0;
  if (c.ev_growth_rate <= 0) return null;

  for (let year = 1; year <= horizon; year++) {
    if (projectedDemandKwh(c, year, shares) >= supply) return year;
  }
  return null;
}

/**
 * A null crossover has two quite different causes and they must not share a
 * label. A shrinking fleet never crosses at any horizon; a growing one with
 * deep surplus simply has not crossed within ten years. Andhra Pradesh's cities
 * are the second kind — growing at 0.3% a year against ample capacity — and
 * calling them "shrinking" would be plainly false.
 */
export function crossoverLabel(
  c: City,
  shares: PublicShares = PUBLIC_SHARE_DEFAULTS,
  horizon: number = PROJECTION_YEARS
): string {
  const year = crossoverYear(c, shares, horizon);
  if (year === 0) return "Already short";
  if (year !== null) return `${year} years`;
  return c.ev_growth_rate <= 0 ? NO_CROSSOVER_LABEL : `Beyond ${horizon} years`;
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                    */
/* -------------------------------------------------------------------------- */

/** 0–1. Standalone Explore metric, not a priority input. */
export const growthScore = (c: City) => clamp(c.ev_growth_rate / MAX_GROWTH_RATE, 0, 1);

/** Public charging points per 1,000 registered EVs. Retained for context only. */
export const chargersPer1000Ev = (c: City) => c.public_chargers / (c.registered_ev / 1000);

export function severityOf(ratio: number): Severity {
  if (ratio >= SEVERITY_THRESHOLDS.critical) return "critical";
  if (ratio >= SEVERITY_THRESHOLDS.moderate) return "moderate";
  return "strong";
}

/**
 * Priority is the unmet energy itself, in kWh/day. The old score multiplied a
 * points-per-EV base by queue, density and population factors, all of which
 * existed to compensate for a base with no physical meaning. A daily energy
 * shortfall needs no such correction: it already scales with fleet size and
 * already reflects how badly served a city is.
 *
 * Cities in surplus score 0 rather than negative — spare capacity is not
 * anti-priority, it is simply no claim on the next station.
 */
export const priorityScore = (c: City, shares: PublicShares = PUBLIC_SHARE_DEFAULTS) =>
  Math.max(0, deficitKwhDay(c, shares));

export function scoreCity(c: City, shares: PublicShares = PUBLIC_SHARE_DEFAULTS): ScoredCity {
  const demand_kwh_day = demandKwhDay(c, shares);
  const supply_kwh_day = supplyKwhDay(c);
  const ratio = supply_kwh_day > 0 ? demand_kwh_day / supply_kwh_day : Infinity;

  return {
    ...c,
    demand_kwh_day,
    supply_kwh_day,
    deficit_kwh_day: demand_kwh_day - supply_kwh_day,
    deficit_ratio: ratio,
    crossover_year: crossoverYear(c, shares),
    chargers_per_1000_ev: chargersPer1000Ev(c),
    growth_score: growthScore(c),
    priority_score: Math.max(0, demand_kwh_day - supply_kwh_day),
    severity: severityOf(ratio),
  };
}

/**
 * Deterministic ranking: priority desc, then demand desc, then name asc.
 * Sorts a copy — callers keep their input order.
 */
export function rankByPriority<T extends ScoredCity>(cities: readonly T[]): T[] {
  return [...cities].sort(
    (a, b) =>
      b.priority_score - a.priority_score ||
      b.demand_kwh_day - a.demand_kwh_day ||
      a.city.localeCompare(b.city)
  );
}

/* -------------------------------------------------------------------------- */
/* State roll-ups                                                             */
/* -------------------------------------------------------------------------- */

export const sumBy = <T>(items: readonly T[], of: (item: T) => number) =>
  items.reduce((total, item) => total + of(item), 0);

/** Weighted mean, guarding against an all-zero weight set. */
const weightedMean = (
  cities: readonly ScoredCity[],
  of: (c: ScoredCity) => number,
  by: (c: ScoredCity) => number
) => {
  const weight = sumBy(cities, by);
  return weight > 0 ? sumBy(cities, (c) => of(c) * by(c)) / weight : 0;
};

/**
 * Rolls a state's cities up into one record. Pure and share-agnostic: it reads
 * whatever `scoreCity` already produced, so a set of cities scored at slider
 * values rolls up at those slider values. Lives here rather than in
 * `lib/aggregate.ts` so the map can call it without importing the dataset.
 */
export function aggregateCities(
  state: string,
  cities: readonly ScoredCity[]
): StateAggregate {
  const registered_ev = sumBy(cities, (c) => c.registered_ev);
  const public_chargers = sumBy(cities, (c) => c.public_chargers);
  const demand_kwh_day = sumBy(cities, (c) => c.demand_kwh_day);
  const supply_kwh_day = sumBy(cities, (c) => c.supply_kwh_day);

  // Aggregate the energy, then take the ratio — averaging city ratios would let
  // a tiny city with almost no supply dominate a whole state's colour.
  const deficit_ratio = supply_kwh_day > 0 ? demand_kwh_day / supply_kwh_day : Infinity;

  return {
    state,
    state_code: cities[0].state_code,
    cities: cities.length,
    population_lakhs: sumBy(cities, (c) => c.population_lakhs),
    registered_ev,
    public_chargers,
    fast_chargers: sumBy(cities, (c) => c.fast_chargers),
    total_kw: sumBy(cities, (c) => c.total_kw),
    chargers_per_1000_ev: public_chargers / (registered_ev / 1000),
    ev_growth_rate: weightedMean(cities, (c) => c.ev_growth_rate, (c) => c.registered_ev),
    demand_kwh_day,
    supply_kwh_day,
    deficit_kwh_day: demand_kwh_day - supply_kwh_day,
    deficit_ratio,
    priority_score: sumBy(cities, (c) => c.priority_score),
    severity: severityOf(deficit_ratio),
  };
}

/**
 * Every state present in `cities`, rolled up and keyed by name. Derived from the
 * cities handed in rather than from the dataset, so a choropleth drawn from it
 * moves with the public-share sliders exactly as the markers do.
 */
export function rollUpByState(
  cities: readonly ScoredCity[]
): Map<string, StateAggregate> {
  const byState = new Map<string, ScoredCity[]>();
  for (const c of cities) {
    const group = byState.get(c.state);
    if (group) group.push(c);
    else byState.set(c.state, [c]);
  }

  return new Map(
    [...byState].map(([state, group]) => [state, aggregateCities(state, group)])
  );
}
