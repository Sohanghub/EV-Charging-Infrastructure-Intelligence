import rawCities from "@/data/cities.json";
import { DAILY_KWH, INDIA_BBOX, PUBLIC_SHARE_DEFAULTS } from "@/lib/constants";
import { rankByPriority, scoreCity, sumBy } from "@/lib/scoring";
import type { City, ScoredCity } from "@/lib/types";

/**
 * `data/cities.json` is the single source of truth. The national figures below
 * are rolled up here at runtime rather than stored, so the two can never drift.
 *
 * State roll-ups deliberately do not live here. They are a pure function of
 * whatever cities you hand them — `rollUpByState` in `lib/scoring.ts` — because
 * the map needs them recomputed at the live slider values, and because keeping
 * them out of this module keeps `data/cities.json` out of the client bundle.
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

/* -------------------------------------------------------------------------- */
/* National figures — the Home page headline                                   */
/* -------------------------------------------------------------------------- */

const nationalRegisteredEv = sumBy(scoredCities, (c) => c.registered_ev);
const nationalDemand = sumBy(scoredCities, (c) => c.demand_kwh_day);
const nationalSupply = sumBy(scoredCities, (c) => c.supply_kwh_day);

export const national = {
  cities: scoredCities.length,
  states: stateNames.length,
  registered_ev: nationalRegisteredEv,
  public_chargers: sumBy(scoredCities, (c) => c.public_chargers),
  fast_chargers: sumBy(scoredCities, (c) => c.fast_chargers),
  total_kw: sumBy(scoredCities, (c) => c.total_kw),
  chargers_per_1000_ev:
    sumBy(scoredCities, (c) => c.public_chargers) / (nationalRegisteredEv / 1000),

  demand_kwh_day: nationalDemand,
  supply_kwh_day: nationalSupply,
  deficit_kwh_day: nationalDemand - nationalSupply,
  deficit_ratio: nationalSupply > 0 ? nationalDemand / nationalSupply : Infinity,
  cities_in_deficit: scoredCities.filter((c) => c.deficit_kwh_day > 0).length,

  /** Share of demand coming from three-wheelers. 92.2% at the default shares. */
  three_wheeler_demand_share:
    sumBy(scoredCities, (c) => c.ev_3w * DAILY_KWH.ev_3w * PUBLIC_SHARE_DEFAULTS.ev_3w) /
    nationalDemand,

  /** Fleet mix — the reason the energy unit matters. */
  fleet: {
    ev_2w: sumBy(scoredCities, (c) => c.ev_2w),
    ev_3w: sumBy(scoredCities, (c) => c.ev_3w),
    ev_4w: sumBy(scoredCities, (c) => c.ev_4w),
    ev_bus: sumBy(scoredCities, (c) => c.ev_bus),
  },
};
