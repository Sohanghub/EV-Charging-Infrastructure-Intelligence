import {
  AC_POINTS_PER_STATION,
  CAPACITY_UTILISATION,
  CHARGING_POINTS_PER_STATION,
  FAST_POINTS_PER_STATION,
  HOURS_PER_DAY,
  RECOMMENDATION_POOL_SIZE,
  STATION_AC_KW,
  STATION_DC_KW,
} from "./constants.ts";
import { rankByPriority } from "./scoring.ts";
import type { Allocation, ImpactSummary, ScoredCity } from "./types.ts";

/**
 * Distributes whole stations across the highest-priority cities. Integer-only:
 * the allocated stations always sum to exactly `totalStations`.
 *
 * Largest-remainder method with a floor of one station per city in the pool.
 */
export function allocateStations(
  cities: readonly ScoredCity[],
  totalStations: number,
  poolSize: number = RECOMMENDATION_POOL_SIZE
): Allocation[] {
  const pool = rankByPriority(cities).slice(0, poolSize);
  if (pool.length === 0) return [];

  // One station each, then share what's left in proportion to priority.
  const guaranteed = Math.min(pool.length, totalStations);
  const remaining = Math.max(0, totalStations - guaranteed);
  const totalPriority = pool.reduce((sum, c) => sum + c.priority_score, 0);

  const raw = pool.map((c, i) =>
    i < guaranteed
      ? 1 + (totalPriority > 0 ? (c.priority_score / totalPriority) * remaining : remaining / pool.length)
      : 0
  );

  const stations = raw.map(Math.floor);
  let leftover = totalStations - stations.reduce((sum, n) => sum + n, 0);

  // Hand the rounding remainder to the largest fractional parts, one at a time.
  const byRemainder = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (let i = 0; leftover > 0; i = (i + 1) % byRemainder.length) {
    stations[byRemainder[i].index] += 1;
    leftover -= 1;
  }

  return pool.map((city, i) => buildAllocation(city, stations[i]));
}

/**
 * Impact is energy delivered, not points installed. A funded station is 2 DC
 * points and 2 AC points, and those are worth very different amounts: at the
 * observed 60 kW and 3.3 kW rates the DC pair carries 95% of a station's
 * capacity. Counting points would treat them as equal, which is the same error
 * at station scale that counting vehicles was at fleet scale.
 */
function buildAllocation(city: ScoredCity, stations: number): Allocation {
  const charging_points = stations * CHARGING_POINTS_PER_STATION;
  const fast_points = stations * FAST_POINTS_PER_STATION;
  const ac_points = stations * AC_POINTS_PER_STATION;

  const added_kw = fast_points * STATION_DC_KW + ac_points * STATION_AC_KW;
  const added_kwh_day = added_kw * HOURS_PER_DAY * CAPACITY_UTILISATION;

  const deficit_before = Math.max(0, city.deficit_kwh_day);
  const deficit_after = Math.max(0, deficit_before - added_kwh_day);
  const deficit_closure =
    deficit_before > 0 ? (deficit_before - deficit_after) / deficit_before : 1;

  return {
    city,
    stations,
    charging_points,
    fast_points,
    ac_points,
    added_kw,
    added_kwh_day,
    deficit_closure,
    deficit_after,
  };
}

/** Allocation-weighted impact across the funded cities. */
export function summarizeImpact(allocations: readonly Allocation[]): ImpactSummary {
  const stations = allocations.reduce((sum, a) => sum + a.stations, 0);
  const weight = stations || 1;

  return {
    stations,
    charging_points: allocations.reduce((sum, a) => sum + a.charging_points, 0),
    cities: allocations.length,
    deficit_closure:
      allocations.reduce((sum, a) => sum + a.deficit_closure * a.stations, 0) / weight,
    added_kwh_day: allocations.reduce((sum, a) => sum + a.added_kwh_day, 0),
    deficit_closed_kwh: allocations.reduce(
      (sum, a) => sum + (Math.max(0, a.city.deficit_kwh_day) - a.deficit_after),
      0
    ),
  };
}
