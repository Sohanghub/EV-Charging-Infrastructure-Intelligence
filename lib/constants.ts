/**
 * Every tunable number in the model lives here. Nothing in `lib/` or the pages
 * should hard-code a threshold, benchmark or bound.
 */

/* -------------------------------------------------------------------------- */
/* Infrastructure units                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A funded station is a fixed 4-point site: 2 DC fast + 2 AC.
 *
 * Note this is not the size of an *existing* station. `scripts/build-cities.mjs`
 * converts the Ministry's station counts at the observed OSM median of 2 points
 * per station, so a funded station is deliberately twice the size of the average
 * one already installed — a designed site rather than the current median. The
 * two are only ever compared in kW, never as station counts.
 */
export const CHARGING_POINTS_PER_STATION = 4;
export const FAST_POINTS_PER_STATION = 2;
export const AC_POINTS_PER_STATION = 2;

/**
 * Rated power of each point type on a funded station, in kW. These match the
 * rates derived from OpenStreetMap in `scripts/build-cities.mjs` — median 60 kW
 * across the DC sockets and 3.3 kW across the AC ones — so a modelled build and
 * the existing estate are measured on the same scale.
 *
 * The gap between them is the point: a DC pair carries ~95% of a station's
 * capacity, so counting points rather than kW would badly misprice a build.
 */
export const STATION_DC_KW = 60;
export const STATION_AC_KW = 3.3;

/** Adequacy benchmark: one public charging point per 250 registered EVs. */
export const EV_PER_CHARGER_BENCHMARK = 250;

/** The same benchmark expressed per 1,000 EVs — the unit used on screen. */
export const CHARGERS_PER_1000_BENCHMARK = 1000 / EV_PER_CHARGER_BENCHMARK; // 4

/* -------------------------------------------------------------------------- */
/* Energy model                                                                */
/* -------------------------------------------------------------------------- */

export type VehicleClass = "ev_2w" | "ev_3w" | "ev_4w" | "ev_bus";

export const VEHICLE_CLASSES: VehicleClass[] = ["ev_2w", "ev_3w", "ev_4w", "ev_bus"];

export const VEHICLE_CLASS_LABELS: Record<VehicleClass, string> = {
  ev_2w: "Two-wheelers",
  ev_3w: "Three-wheelers",
  ev_4w: "Four-wheelers",
  ev_bus: "Buses",
};

/**
 * Duty cycle per class. The three-wheeler figures — 90 km/day at 0.06 kWh/km —
 * are the ones that matter: three-wheelers are 42% of the modelled fleet and
 * carry 92.2% of modelled public demand. Vahan records 99.9% of them as
 * transport registrations, so 90 km/day reads as a floor for a commercial duty
 * cycle rather than a central estimate.
 *
 * The other three classes are assumptions, not measurements, and only move the
 * national result by a few percent between them. Treat any figure but the 3W one
 * as indicative.
 */
export const KM_PER_DAY: Record<VehicleClass, number> = {
  ev_2w: 30,
  ev_3w: 90,
  ev_4w: 40,
  ev_bus: 150,
};

export const KWH_PER_KM: Record<VehicleClass, number> = {
  ev_2w: 0.03,
  ev_3w: 0.06,
  ev_4w: 0.164,
  ev_bus: 1.2,
};

/** Total energy a vehicle of each class consumes per day, public and private. */
export const DAILY_KWH: Record<VehicleClass, number> = {
  ev_2w: KM_PER_DAY.ev_2w * KWH_PER_KM.ev_2w, // 0.90
  ev_3w: KM_PER_DAY.ev_3w * KWH_PER_KM.ev_3w, // 5.40
  ev_4w: KM_PER_DAY.ev_4w * KWH_PER_KM.ev_4w, // 6.56
  ev_bus: KM_PER_DAY.ev_bus * KWH_PER_KM.ev_bus, // 180.00
};

/**
 * Share of each class's energy drawn from public charging points — the live
 * slider, and the parameter nobody has measured. Two-wheelers overwhelmingly
 * charge at home; buses overwhelmingly charge at private depots, which is why
 * their share is low despite a large daily draw. The three-wheeler value is the
 * one the national result turns on.
 */
export const PUBLIC_SHARE_DEFAULTS: Record<VehicleClass, number> = {
  ev_2w: 0.1,
  ev_3w: 0.7,
  ev_4w: 0.2,
  ev_bus: 0.1,
};

export const PUBLIC_SHARE_MIN = 0;
export const PUBLIC_SHARE_MAX = 1;
export const PUBLIC_SHARE_STEP = 0.05;

/**
 * Fraction of nameplate capacity a charging point actually delivers over a day.
 * Public charging in India is reported to run far below rated throughput; this
 * is the largest single assumption on the supply side.
 */
export const CAPACITY_UTILISATION = 0.2;

/** Hours a charging point is available per day. */
export const HOURS_PER_DAY = 24;

/**
 * Break-even public draw per three-wheeler, in kWh/day, at national scale.
 * Below this India has surplus public charging capacity; above it, a deficit.
 * Published as an energy figure rather than a share because the share depends
 * on an assumed daily total that does the work invisibly.
 */
export const THREE_WHEELER_BREAKEVEN_KWH = 1.99;

/** Horizon for the demand projection, in years. */
export const PROJECTION_YEARS = 10;

/* -------------------------------------------------------------------------- */
/* Scoring                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * YoY EV growth that earns a full growth score. The only scoring tunable left:
 * the queue, density and population multipliers are gone along with the
 * fabricated fields they read, and `scripts/check.mjs` asserts they stay gone.
 */
export const MAX_GROWTH_RATE = 0.6;

/* -------------------------------------------------------------------------- */
/* Allocation                                                                  */
/* -------------------------------------------------------------------------- */

export const SLIDER_MIN_STATIONS = 25;
export const SLIDER_MAX_STATIONS = 1000;
export const SLIDER_STEP_STATIONS = 25;
export const SLIDER_DEFAULT_STATIONS = 250;

/** Cities that share the funded stations. */
export const RECOMMENDATION_POOL_SIZE = 15;

/* -------------------------------------------------------------------------- */
/* Severity                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Bands in demand/supply ratio, fixed rather than percentile-based. Both cut
 * points are physical: 1.0 is break-even, where a city's fleet draws exactly
 * what its chargers can deliver, and 2.0 is demand at double installed capacity.
 *
 * Percentile bands were rejected deliberately. Fixed cut points mean the sliders
 * move cities between bands, and that movement is the point of the interface —
 * percentiles would hold the band sizes constant and hide the sensitivity.
 */
export const SEVERITY_THRESHOLDS = {
  /** Demand at or above twice installed capacity. */
  critical: 2,
  /** Demand exceeds supply at all. */
  moderate: 1,
} as const;

export type Severity = "critical" | "moderate" | "strong";

/* -------------------------------------------------------------------------- */
/* Geography                                                                   */
/* -------------------------------------------------------------------------- */

/** Validation bounding box for India. */
export const INDIA_BBOX = { minLat: 6, maxLat: 36, minLng: 68, maxLng: 98 } as const;

/** Mainland + island bounds. The map fits these rather than guessing a zoom,
 *  so India is centred and fills the container at any aspect ratio. */
export const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.5, 68.0],
  [35.8, 97.5],
];

export const MAP_MIN_ZOOM = 3.5;
export const MAP_MAX_ZOOM = 9;

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const TILE_URLS = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
} as const;

/* -------------------------------------------------------------------------- */
/* Palette — semantic, shared by charts and map                                */
/* -------------------------------------------------------------------------- */

export const PALETTE = {
  /** Demand-side series (EVs, growth, sessions). */
  demand: "#2563eb",
  /** Supply-side series (chargers, stations, allocation). */
  infrastructure: "#059669",
  warning: "#d97706",
  critical: "#dc2626",
  neutral: "#64748b",
} as const;

/** Marker / choropleth fill by severity band. */
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: PALETTE.critical,
  moderate: PALETTE.warning,
  strong: PALETTE.infrastructure,
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Demand over 2x supply",
  moderate: "Demand exceeds supply",
  strong: "Supply covers demand",
};

/** Shown where a city's fleet is shrinking, so demand never overtakes supply. */
export const NO_CROSSOVER_LABEL = "Fleet shrinking";
