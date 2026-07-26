import rawCities from "@/data/cities.json";
import { DAILY_KWH, INDIA_BBOX, PUBLIC_SHARE_DEFAULTS } from "@/lib/constants";
import {
  deficitKwhDay,
  demandKwhDay,
  rankByPriority,
  scoreCity,
  severityOf,
  supplyKwhDay,
} from "@/lib/scoring";
import type { City, PublicShares, ScoredCity, StateAggregate } from "@/lib/types";

/**
 * `data/cities.json` is the single source of truth. State-level numbers are
 * rolled up here at runtime rather than stored, so the two can never drift.
 *
 * Validation runs once, on module load, in dev and at build time.
 */

function validate(cities: readonly City[]): void {
  const seen = new Set<string>();

  for (const c of cities) {
    const at = `${c.city} (${c.id})`;
    const fail = (message: string): never => {
      throw new Error(`data/cities.json: ${at} ${message}`);
    };

    if (seen.has(c.id)) fail(`has a duplicate id`);
    seen.add(c.id);

    if (c.lat < INDIA_BBOX.minLat || c.lat > INDIA_BBOX.maxLat)
      fail(`has lat ${c.lat} outside India (${INDIA_BBOX.minLat}-${INDIA_BBOX.maxLat})`);
    if (c.lng < INDIA_BBOX.minLng || c.lng > INDIA_BBOX.maxLng)
      fail(`has lng ${c.lng} outside India (${INDIA_BBOX.minLng}-${INDIA_BBOX.maxLng})`);

    if (c.registered_ev <= 0) fail(`has registered_ev ${c.registered_ev}, must be > 0`);
    if (c.population_lakhs <= 0)
      fail(`has population_lakhs ${c.population_lakhs}, must be > 0`);

    if (c.fast_chargers > c.public_chargers)
      fail(`has ${c.fast_chargers} fast chargers of ${c.public_chargers} public chargers`);

    if (c.renewable_share < 0 || c.renewable_share > 1)
      fail(`has renewable_share ${c.renewable_share}, must be a 0-1 decimal`);

    // Real Vahan growth is signed — some states registered fewer EVs in 2023
    // than 2022 — so this is a sanity bound, not the old synthetic 0.05-0.85.
    if (c.ev_growth_rate < -1 || c.ev_growth_rate > 5)
      fail(`has ev_growth_rate ${c.ev_growth_rate}, outside the plausible -1 to 5`);

    const classSum = c.ev_2w + c.ev_3w + c.ev_4w + c.ev_bus;
    if (classSum > c.registered_ev + 1)
      fail(`has class counts summing to ${classSum} against ${c.registered_ev} registered EVs`);

    // Capacity must track the point count: no points means no kW, and the
    // implied per-point rate has to sit between the AC and DC rates.
    if (c.total_kw < 0) fail(`has negative total_kw ${c.total_kw}`);
    if (c.public_chargers === 0 && c.total_kw !== 0)
      fail(`has ${c.total_kw} kW across zero charging points`);
    if (c.public_chargers > 0) {
      const perPoint = c.total_kw / c.public_chargers;
      if (perPoint < 1 || perPoint > 400)
        fail(`has an implausible ${perPoint.toFixed(1)} kW per point`);
    }

    for (const field of ["registration_confidence", "supply_confidence"] as const)
      if (!["reported", "modelled", "imputed"].includes(c[field]))
        fail(`has an unknown ${field} "${c[field]}"`);
  }
}

const cities = rawCities as City[];
validate(cities);

/** Every city, scored. Sorted by priority — the ranking used everywhere. */
export const scoredCities: ScoredCity[] = rankByPriority(cities.map((c) => scoreCity(c)));

/** Alphabetical state names, for filters. */
export const stateNames: string[] = [
  ...new Set(scoredCities.map((c) => c.state)),
].sort((a, b) => a.localeCompare(b));

const sum = (cities: readonly ScoredCity[], of: (c: ScoredCity) => number) =>
  cities.reduce((total, c) => total + of(c), 0);

/** Weighted mean, guarding against an all-zero weight set. */
const weightedMean = (
  cities: readonly ScoredCity[],
  of: (c: ScoredCity) => number,
  by: (c: ScoredCity) => number
) => {
  const weight = sum(cities, by);
  return weight > 0 ? sum(cities, (c) => of(c) * by(c)) / weight : 0;
};

function aggregate(state: string, cities: readonly ScoredCity[]): StateAggregate {
  const registered_ev = sum(cities, (c) => c.registered_ev);
  const public_chargers = sum(cities, (c) => c.public_chargers);
  const demand_kwh_day = sum(cities, (c) => c.demand_kwh_day);
  const supply_kwh_day = sum(cities, (c) => c.supply_kwh_day);

  // Aggregate the energy, then take the ratio — averaging city ratios would let
  // a tiny city with almost no supply dominate a whole state's colour.
  const deficit_ratio = supply_kwh_day > 0 ? demand_kwh_day / supply_kwh_day : Infinity;

  return {
    state,
    state_code: cities[0].state_code,
    cities: cities.length,
    population_lakhs: sum(cities, (c) => c.population_lakhs),
    registered_ev,
    public_chargers,
    fast_chargers: sum(cities, (c) => c.fast_chargers),
    total_kw: sum(cities, (c) => c.total_kw),
    chargers_per_1000_ev: public_chargers / (registered_ev / 1000),
    ev_growth_rate: weightedMean(cities, (c) => c.ev_growth_rate, (c) => c.registered_ev),
    demand_kwh_day,
    supply_kwh_day,
    deficit_kwh_day: demand_kwh_day - supply_kwh_day,
    deficit_ratio,
    priority_score: sum(cities, (c) => c.priority_score),
    severity: severityOf(deficit_ratio),
  };
}

/** State roll-ups, computed from `scoredCities`. Never read from disk. */
export const stateAggregates: StateAggregate[] = stateNames.map((state) =>
  aggregate(
    state,
    scoredCities.filter((c) => c.state === state)
  )
);

const byState = new Map(stateAggregates.map((s) => [s.state, s]));
export const stateAggregate = (state: string) => byState.get(state);

/* -------------------------------------------------------------------------- */
/* National figures — the Home page headline                                   */
/* -------------------------------------------------------------------------- */

const nationalRegisteredEv = sum(scoredCities, (c) => c.registered_ev);
const nationalDemand = sum(scoredCities, (c) => c.demand_kwh_day);
const nationalSupply = sum(scoredCities, (c) => c.supply_kwh_day);

export const national = {
  cities: scoredCities.length,
  states: stateNames.length,
  registered_ev: nationalRegisteredEv,
  public_chargers: sum(scoredCities, (c) => c.public_chargers),
  fast_chargers: sum(scoredCities, (c) => c.fast_chargers),
  total_kw: sum(scoredCities, (c) => c.total_kw),
  chargers_per_1000_ev:
    sum(scoredCities, (c) => c.public_chargers) / (nationalRegisteredEv / 1000),

  demand_kwh_day: nationalDemand,
  supply_kwh_day: nationalSupply,
  deficit_kwh_day: nationalDemand - nationalSupply,
  deficit_ratio: nationalSupply > 0 ? nationalDemand / nationalSupply : Infinity,
  cities_in_deficit: scoredCities.filter((c) => c.deficit_kwh_day > 0).length,

  /** Share of demand coming from three-wheelers. 92.2% at the default shares. */
  three_wheeler_demand_share:
    sum(scoredCities, (c) => c.ev_3w * DAILY_KWH.ev_3w * PUBLIC_SHARE_DEFAULTS.ev_3w) /
    nationalDemand,

  /** Fleet mix — the reason the energy unit matters. */
  fleet: {
    ev_2w: sum(scoredCities, (c) => c.ev_2w),
    ev_3w: sum(scoredCities, (c) => c.ev_3w),
    ev_4w: sum(scoredCities, (c) => c.ev_4w),
    ev_bus: sum(scoredCities, (c) => c.ev_bus),
  },
};

/* -------------------------------------------------------------------------- */
/* Energy roll-ups — slider-dependent, so computed on demand, never stored     */
/* -------------------------------------------------------------------------- */

/**
 * National demand, supply and deficit in kWh/day at a given set of public-share
 * assumptions. Takes the shares as an argument rather than reading a default,
 * because the whole point of the model is that the answer moves with them.
 */
export function nationalEnergy(shares: PublicShares) {
  const demand = sum(scoredCities, (c) => demandKwhDay(c, shares));
  const supply = sum(scoredCities, supplyKwhDay);

  return {
    demand,
    supply,
    deficit: demand - supply,
    /** Cities whose demand already exceeds their installed capacity. */
    cities_in_deficit: scoredCities.filter((c) => deficitKwhDay(c, shares) > 0).length,
    /** Share of demand coming from three-wheelers — 92.2% at the default shares. */
    three_wheeler_share:
      sum(scoredCities, (c) => c.ev_3w * DAILY_KWH.ev_3w * shares.ev_3w) / demand,
  };
}

/** Per-state energy roll-up, for the map and state table. */
export function stateEnergy(state: string, shares: PublicShares) {
  const cities = scoredCities.filter((c) => c.state === state);
  const demand = sum(cities, (c) => demandKwhDay(c, shares));
  const supply = sum(cities, supplyKwhDay);
  return { state, demand, supply, deficit: demand - supply };
}
