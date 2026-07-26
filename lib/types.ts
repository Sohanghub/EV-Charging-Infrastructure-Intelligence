import type { Severity, VehicleClass } from "./constants.ts";

/**
 * How far a figure can be trusted. Set per row by `scripts/build-cities.mjs`.
 *   reported — published at this resolution and used unchanged
 *   modelled — a real state total split across that state's cities
 *   imputed  — the state total itself was estimated (Telangana, absent from Vahan)
 */
export type Confidence = "reported" | "modelled" | "imputed";

/** One record of `data/cities.json`. Rates are decimals, never percentages. */
export interface City {
  /** `"KA-01"` — state_code + two-digit sequence. */
  id: string;
  city: string;
  /** Must match a `st_nm` in `data/india-states.geojson`. */
  state: string;
  state_code: string;
  lat: number;
  lng: number;

  /** 1 lakh = 100,000 people. */
  population_lakhs: number;

  /** Total registered EVs, all classes. */
  registered_ev: number;
  /** Class split of `registered_ev`, from Vahan's class-coded table. */
  ev_2w: number;
  ev_3w: number;
  ev_4w: number;
  ev_bus: number;
  /**
   * Decimal YoY growth, 2022→2023, from Vahan. Real and therefore occasionally
   * negative — Uttarakhand registered fewer EVs in 2023 than in 2022.
   */
  ev_growth_rate: number;

  /** Total public charging points, all types. */
  public_chargers: number;
  /** Subset of `public_chargers` rated >= 50 kW DC. */
  fast_chargers: number;
  /** Installed capacity in kW: fast points at the DC rate, the rest at AC. */
  total_kw: number;

  /** Decimal 0–1 grid renewable share, state-level (CEA). */
  renewable_share: number;

  /** Provenance of the registration figures on this row. */
  registration_confidence: Confidence;
  /** Provenance of the charging-supply figures on this row. */
  supply_confidence: Confidence;
  /** Stations actually mapped in OSM within 25 km — the real signal behind the split. */
  osm_stations: number;
}

/** Public charging share per vehicle class — the live slider values. */
export type PublicShares = Record<VehicleClass, number>;

/**
 * A city plus every metric derived from it. Derived in `lib/scoring.ts` against
 * a given set of public-charging shares, so this is not a static roll-up: move
 * a slider and every field below it changes, including `severity`.
 */
export interface ScoredCity extends City {
  /** Public charging energy the fleet demands, kWh/day. */
  demand_kwh_day: number;
  /** Energy installed capacity can deliver, kWh/day. */
  supply_kwh_day: number;
  /** Positive means unmet demand. */
  deficit_kwh_day: number;
  /** Demand as a multiple of supply. 1.0 is break-even. */
  deficit_ratio: number;
  /** Years until demand overtakes supply; null when the fleet is shrinking. */
  crossover_year: number | null;
  chargers_per_1000_ev: number;
  growth_score: number;
  /** The unmet energy, floored at zero. */
  priority_score: number;
  severity: Severity;
}

/** Runtime roll-up of cities by state. Never stored on disk. */
export interface StateAggregate {
  state: string;
  state_code: string;
  cities: number;
  population_lakhs: number;
  registered_ev: number;
  public_chargers: number;
  fast_chargers: number;
  total_kw: number;
  chargers_per_1000_ev: number;
  /** EV-weighted mean growth rate, decimal. */
  ev_growth_rate: number;
  demand_kwh_day: number;
  supply_kwh_day: number;
  deficit_kwh_day: number;
  deficit_ratio: number;
  /** Total unmet energy across the state's cities, kWh/day. */
  priority_score: number;
  severity: Severity;
}

/** One city's share of a funded investment, plus its modelled impact. */
export interface Allocation {
  city: ScoredCity;
  /** Whole stations funded. Always >= 1 within the pool. */
  stations: number;
  /** `stations x CHARGING_POINTS_PER_STATION`. */
  charging_points: number;
  fast_points: number;
  ac_points: number;
  /** Capacity the funded stations add, in kW. */
  added_kw: number;
  /** Energy the funded stations deliver per day, kWh. */
  added_kwh_day: number;
  /** Decimal 0–1 share of the city's energy deficit closed. */
  deficit_closure: number;
  /** Unmet energy still outstanding after the build, kWh/day. */
  deficit_after: number;
}

export interface ImpactSummary {
  stations: number;
  charging_points: number;
  cities: number;
  /** Allocation-weighted mean deficit closure, decimal 0–1. */
  deficit_closure: number;
  /** Total energy the funded build delivers per day, kWh. */
  added_kwh_day: number;
  /** Unmet energy removed across the pool, kWh/day. */
  deficit_closed_kwh: number;
}

export interface Methodology {
  data_sources: { name: string; url: string; note: string }[];
  definitions: { term: string; definition: string }[];
  scoring_weights: { term: string; rationale: string }[];
  assumptions: string[];
  limitations: string[];
}
