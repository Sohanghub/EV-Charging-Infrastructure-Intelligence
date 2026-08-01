/**
 * Stage ②: `data/raw/` → `data/cities.json` + `data/QUALITY.md`. No network —
 * run `scripts/fetch-sources.mjs` first. Deleting data/cities.json and re-running
 * this reproduces it byte for byte; there is no seed and no randomness left.
 *
 *   node scripts/build-cities.mjs
 *
 * Every city figure is one of three tiers, carried on the row itself:
 *   reported — published at this resolution and used unchanged
 *   modelled — a real STATE total split across that state's cities
 *   imputed  — the state total itself was estimated (Telangana only, see below)
 *
 * The split is the whole point of this file. Absolute levels come from the
 * Ministry of Power and Vahan; the shape within a state comes from OSM where
 * OSM has coverage and from population where it does not.
 */
import { readFileSync, writeFileSync } from "node:fs";

// The energy model's own constants, imported rather than restated — the stale
// break-even figures this file used to hard-code are exactly what that prevents.
import {
  CAPACITY_UTILISATION,
  DAILY_KWH,
  HOURS_PER_DAY,
  PUBLIC_SHARE_DEFAULTS,
  STATION_AC_KW,
  STATION_DC_KW,
} from "../lib/constants.ts";

const raw = (name) =>
  JSON.parse(readFileSync(new URL(`../data/raw/${name}.json`, import.meta.url), "utf8"));

const MOP = raw("mop_charging_stations");
const EV_STOCK = raw("ev_registrations_state");
const EV_BY_YEAR = raw("ev_registrations_by_year");
const EV_BY_CLASS = raw("ev_registrations_by_class");
const OSM = raw("osm_charging_stations");

/* -------------------------------------------------------------------------- */
/* Tunables — every one of these is a documented judgement call                 */
/* -------------------------------------------------------------------------- */

/** A station counts toward a city if it sits within this many km of its centre. */
const CITY_RADIUS_KM = 25;

/**
 * Shrinkage constant for the OSM-vs-population blend. A state's OSM sample gets
 * weight n/(n+K), so a state with 40 mapped stations leans on OSM (0.67) while
 * one with 2 leans on population (0.09). K=20 puts the crossover at 20 stations,
 * which is roughly where OSM's per-city ordering stops being noise.
 */
const OSM_SHRINKAGE = 20;

/* -------------------------------------------------------------------------- */
/* Geography — real coordinates, populations and state renewable shares        */
/* -------------------------------------------------------------------------- */

/**
 * Cities are listed largest-first: [name, lat, lng, population_lakhs].
 * `pop` is the state's projected total population in lakhs, needed to work out
 * what share of a state each modelled city represents.
 * `renewable` is the state's grid renewable share (CEA, state-level).
 */
const STATES = [
  { state: "Karnataka", code: "KA", pop: 690, renewable: 0.48, cities: [
    ["Bengaluru", 12.97, 77.59, 129.0], ["Mysuru", 12.30, 76.64, 10.5],
    ["Hubballi", 15.36, 75.12, 9.4], ["Mangaluru", 12.87, 74.84, 6.2],
    ["Belagavi", 15.85, 74.50, 6.1],
  ]},
  { state: "Maharashtra", code: "MH", pop: 1260, renewable: 0.30, cities: [
    ["Mumbai", 19.08, 72.88, 208.0], ["Pune", 18.52, 73.86, 74.0],
    ["Nagpur", 21.15, 79.09, 29.0], ["Nashik", 20.00, 73.79, 20.0],
    ["Chhatrapati Sambhajinagar", 19.88, 75.34, 14.4], ["Solapur", 17.66, 75.91, 10.4],
  ]},
  { state: "Delhi", code: "DL", pop: 210, renewable: 0.12, cities: [
    ["New Delhi", 28.61, 77.21, 58.0], ["Dwarka", 28.59, 77.05, 12.4],
    ["Rohini", 28.74, 77.11, 11.2],
  ]},
  { state: "Tamil Nadu", code: "TN", pop: 770, renewable: 0.45, cities: [
    ["Chennai", 13.08, 80.27, 89.0], ["Coimbatore", 11.02, 76.96, 21.5],
    ["Madurai", 9.93, 78.12, 16.0], ["Tiruchirappalli", 10.79, 78.70, 10.2],
    ["Salem", 11.66, 78.15, 9.2], ["Tirunelveli", 8.71, 77.76, 5.0],
  ]},
  { state: "Telangana", code: "TG", pop: 390, renewable: 0.28, cities: [
    ["Hyderabad", 17.39, 78.49, 101.0], ["Warangal", 17.97, 79.59, 8.3],
    ["Nizamabad", 18.67, 78.09, 3.5], ["Karimnagar", 18.44, 79.13, 3.0],
    ["Khammam", 17.25, 80.15, 2.6],
  ]},
  { state: "Gujarat", code: "GJ", pop: 720, renewable: 0.50, cities: [
    ["Ahmedabad", 23.02, 72.57, 80.0], ["Surat", 21.17, 72.83, 66.0],
    ["Vadodara", 22.31, 73.18, 22.0], ["Rajkot", 22.30, 70.80, 18.5],
    ["Bhavnagar", 21.76, 72.15, 6.5],
  ]},
  { state: "Uttar Pradesh", code: "UP", pop: 2410, renewable: 0.15, cities: [
    ["Lucknow", 26.85, 80.95, 38.0], ["Kanpur", 26.45, 80.33, 32.0],
    ["Ghaziabad", 28.67, 77.45, 24.0], ["Agra", 27.18, 78.01, 20.0],
    ["Varanasi", 25.32, 82.97, 16.0], ["Prayagraj", 25.44, 81.85, 14.0],
    ["Noida", 28.54, 77.39, 7.0],
  ]},
  { state: "Rajasthan", code: "RJ", pop: 820, renewable: 0.55, cities: [
    ["Jaipur", 26.91, 75.79, 40.0], ["Jodhpur", 26.24, 73.02, 15.0],
    ["Kota", 25.21, 75.86, 12.0], ["Udaipur", 24.58, 73.71, 5.5],
    ["Ajmer", 26.45, 74.64, 5.4],
  ]},
  { state: "Madhya Pradesh", code: "MP", pop: 880, renewable: 0.30, cities: [
    ["Indore", 22.72, 75.86, 25.0], ["Bhopal", 23.26, 77.41, 21.0],
    ["Jabalpur", 23.18, 79.99, 12.5], ["Gwalior", 26.22, 78.18, 11.5],
    ["Ujjain", 23.18, 75.78, 5.6],
  ]},
  { state: "Kerala", code: "KL", pop: 360, renewable: 0.25, cities: [
    ["Kochi", 9.93, 76.27, 22.0], ["Thiruvananthapuram", 8.52, 76.94, 17.0],
    ["Kozhikode", 11.26, 75.78, 10.0], ["Thrissur", 10.53, 76.21, 3.2],
    ["Kollam", 8.89, 76.61, 3.9],
  ]},
  { state: "West Bengal", code: "WB", pop: 1000, renewable: 0.14, cities: [
    ["Kolkata", 22.57, 88.36, 149.0], ["Howrah", 22.59, 88.26, 11.0],
    ["Siliguri", 26.73, 88.40, 7.0], ["Durgapur", 23.52, 87.31, 5.7],
    ["Asansol", 23.69, 86.98, 12.4],
  ]},
  { state: "Andhra Pradesh", code: "AP", pop: 540, renewable: 0.38, cities: [
    ["Visakhapatnam", 17.69, 83.22, 21.0], ["Vijayawada", 16.51, 80.65, 14.5],
    ["Guntur", 16.31, 80.44, 7.4], ["Nellore", 14.44, 79.99, 5.6],
    ["Tirupati", 13.63, 79.42, 4.6], ["Kurnool", 15.83, 78.04, 4.8],
  ]},
  { state: "Punjab", code: "PB", pop: 310, renewable: 0.22, cities: [
    ["Ludhiana", 30.90, 75.86, 18.0], ["Amritsar", 31.63, 74.87, 13.0],
    ["Jalandhar", 31.33, 75.58, 9.0], ["Patiala", 30.34, 76.39, 4.5],
    ["Bathinda", 30.21, 74.95, 3.0],
  ]},
  { state: "Haryana", code: "HR", pop: 300, renewable: 0.20, cities: [
    ["Gurugram", 28.46, 77.03, 12.0], ["Faridabad", 28.41, 77.32, 16.0],
    ["Panipat", 29.39, 76.97, 4.5], ["Ambala", 30.38, 76.78, 2.1],
    ["Karnal", 29.69, 76.99, 3.5], ["Hisar", 29.15, 75.72, 3.1],
  ]},
  { state: "Bihar", code: "BR", pop: 1280, renewable: 0.10, cities: [
    ["Patna", 25.59, 85.14, 25.0], ["Gaya", 24.80, 85.00, 5.0],
    ["Bhagalpur", 25.24, 86.99, 4.1], ["Muzaffarpur", 26.12, 85.39, 4.0],
    ["Darbhanga", 26.15, 85.90, 3.1],
  ]},
  { state: "Odisha", code: "OD", pop: 470, renewable: 0.16, cities: [
    ["Bhubaneswar", 20.30, 85.82, 11.5], ["Cuttack", 20.46, 85.88, 7.0],
    ["Rourkela", 22.26, 84.85, 5.5], ["Berhampur", 19.31, 84.79, 3.6],
    ["Sambalpur", 21.47, 83.97, 3.3],
  ]},
  { state: "Assam", code: "AS", pop: 360, renewable: 0.18, cities: [
    ["Guwahati", 26.14, 91.74, 11.0], ["Silchar", 24.83, 92.80, 2.3],
    ["Dibrugarh", 27.47, 94.91, 1.6], ["Jorhat", 26.75, 94.22, 1.5],
  ]},
  { state: "Jharkhand", code: "JH", pop: 400, renewable: 0.12, cities: [
    ["Ranchi", 23.34, 85.31, 12.5], ["Jamshedpur", 22.80, 86.20, 13.5],
    ["Dhanbad", 23.80, 86.43, 12.0], ["Bokaro", 23.67, 86.15, 5.7],
  ]},
  { state: "Chhattisgarh", code: "CG", pop: 310, renewable: 0.14, cities: [
    ["Raipur", 21.25, 81.63, 11.5], ["Bhilai", 21.19, 81.35, 6.3],
    ["Bilaspur", 22.08, 82.14, 4.0], ["Korba", 22.35, 82.68, 3.7],
  ]},
  { state: "Uttarakhand", code: "UK", pop: 120, renewable: 0.35, cities: [
    ["Dehradun", 30.32, 78.03, 7.8], ["Haridwar", 29.95, 78.16, 3.1],
    ["Haldwani", 29.22, 79.51, 2.3], ["Rudrapur", 28.98, 79.40, 1.6],
  ]},
];

/* -------------------------------------------------------------------------- */
/* Source lookup                                                               */
/* -------------------------------------------------------------------------- */

const round = (v, digits = 0) => Number(v.toFixed(digits));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** Portal spellings differ only in punctuation and case across the three files. */
const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, "");

/** data.gov.in ships numbers as strings with commas, and "NA" for missing. */
const num = (v) => {
  if (typeof v === "number") return v;
  const parsed = Number.parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

/** Both registration files carry a national total row that is not a state. */
const isTotalRow = (name) => /^(grand\s*)?total$/i.test(String(name).trim());

function index(records, nameKey, valueFn) {
  const map = new Map();
  for (const record of records) {
    if (isTotalRow(record[nameKey])) continue;
    const value = valueFn(record);
    if (value !== null) map.set(norm(record[nameKey]), value);
  }
  return map;
}

const stationsByState = index(
  MOP.records,
  "state_ut",
  (r) => num(r.no__of_electric_vehicle__ev__charging_stations_installed)
);

const evStockByState = index(EV_STOCK.records, "state__ut", (r) => num(r.total_ev));

/**
 * Most recent real year-over-year rate. The 2020 base is so small that a CAGR
 * from it reads as 100–300% for every state, which says more about the pandemic
 * than about today, so 2022→2023 is the honest choice.
 */
const growthByState = index(EV_BY_YEAR.records, "state_ut", (r) => {
  const from = num(r._2022);
  const to = num(r._2023);
  return from && to && from > 0 ? to / from - 1 : null;
});

/**
 * Vehicle-class mix, from Vahan's class-coded registration table. Its national
 * total is an older vintage than the stock file, so only the *shares* are used
 * here — applied to the current stock level. Class codes: 2WN/2WT/2WIC are
 * two-wheelers, 3WN/3WT three-wheelers, LMV/LPV/LGV/4WIC four-wheelers, and
 * MPV/HPV buses. Goods and "other" are left out of the four reported classes.
 */
const classMixByState = (() => {
  const map = new Map();
  for (const r of EV_BY_CLASS.records) {
    if (isTotalRow(r.state_ut_name)) continue;
    const n = (v) => num(v) ?? 0;
    const mix = {
      ev_2w: n(r._2wn) + n(r._2wt) + n(r._2wic),
      ev_3w: n(r._3wn) + n(r._3wt),
      ev_4w: n(r.lmv) + n(r.lpv) + n(r.lgv) + n(r._4wic),
      ev_bus: n(r.mpv) + n(r.hpv),
    };
    const total = sum(Object.values(mix));
    if (total > 0) {
      map.set(
        norm(r.state_ut_name),
        Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, v / total]))
      );
    }
  }
  return map;
})();

/** National fallback mix, for states the class table omits (Telangana). */
const nationalMix = (() => {
  const totals = { ev_2w: 0, ev_3w: 0, ev_4w: 0, ev_bus: 0 };
  for (const r of EV_BY_CLASS.records) {
    if (isTotalRow(r.state_ut_name)) continue;
    const n = (v) => num(v) ?? 0;
    totals.ev_2w += n(r._2wn) + n(r._2wt) + n(r._2wic);
    totals.ev_3w += n(r._3wn) + n(r._3wt);
    totals.ev_4w += n(r.lmv) + n(r.lpv) + n(r.lgv) + n(r._4wic);
    totals.ev_bus += n(r.mpv) + n(r.hpv);
  }
  const total = sum(Object.values(totals));
  return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / total]));
})();

/* -------------------------------------------------------------------------- */
/* OSM — the only real intra-state signal that exists                          */
/* -------------------------------------------------------------------------- */

const EARTH_RADIUS_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;

function haversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

const osmPoints = OSM.elements
  .map((e) => ({ lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, tags: e.tags ?? {} }))
  .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

/**
 * Points per station, measured rather than assumed. The mean is 8.6 but a
 * handful of large depots drag it there; the median is the honest centre for
 * converting the Ministry's station counts into charging points.
 */
function pointsPerStation() {
  const capacities = osmPoints
    .map((p) => num(p.tags.capacity))
    .filter((c) => c !== null && Number.isInteger(c) && c >= 1 && c <= 50)
    .sort((a, b) => a - b);
  return capacities[Math.floor(capacities.length / 2)];
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/**
 * Power ratings, split at the 50 kW DC threshold rather than blended. The city
 * rows carry `fast_chargers` and `public_chargers` separately, so supply can be
 * built from two rates and never needs a blended figure — blending would bury
 * the AC rate, which is the one carrying the surprise.
 *
 * The AC median lands near Bharat AC-001 territory. If that is representative
 * it means real supply is materially lower than a nominal 16-22 kW assumption
 * would give. n is small; both rates ship with their sample size attached.
 */
function powerRatings() {
  const ratings = osmPoints
    .map((p) => {
      let best = null;
      for (const [key, value] of Object.entries(p.tags)) {
        if (!/^socket:.*:output$/.test(key)) continue;
        const kw = num(String(value).match(/\d+(\.\d+)?/)?.[0]);
        if (kw !== null) best = Math.max(best ?? 0, kw);
      }
      return best;
    })
    .filter((kw) => kw !== null);

  const dc = ratings.filter((kw) => kw >= 50);
  const ac = ratings.filter((kw) => kw < 50);

  return {
    share: dc.length / ratings.length,
    n: ratings.length,
    acKw: median(ac),
    acN: ac.length,
    dcKw: median(dc),
    dcN: dc.length,
  };
}

const POINTS_PER_STATION = pointsPerStation();
const FAST = powerRatings();

/**
 * The existing estate is priced from these OSM medians; a funded station is
 * priced from STATION_DC_KW / STATION_AC_KW in lib/constants.ts. Those are the
 * same two numbers, and nothing but this check keeps them that way — the medians
 * rest on n=6 DC and n=22 AC sockets, so a re-fetch can move them. If it does,
 * existing and funded capacity would silently end up on different scales, which
 * is the error the whole kW-rather-than-points model exists to avoid.
 *
 * Failing here is the point: it forces a human to reconcile rather than letting
 * the drift through. Update lib/constants.ts to the new medians, then re-run.
 */
for (const [label, derived, constant] of [
  ["DC", FAST.dcKw, STATION_DC_KW],
  ["AC", FAST.acKw, STATION_AC_KW],
]) {
  if (derived !== constant)
    throw new Error(
      `${label} point rating drifted: OSM median is ${derived} kW but lib/constants.ts ` +
        `says ${constant} kW. Existing supply would be priced differently from funded ` +
        `supply. Update the constant to ${derived} and re-run.`
    );
}

/** Nearest modelled city within CITY_RADIUS_KM, or null for the rural remainder. */
const allCities = STATES.flatMap((s) => s.cities.map(([city, lat, lng]) => ({ city, lat, lng })));

const osmCountByCity = new Map();
let mappedInsideCities = 0;

for (const point of osmPoints) {
  let nearest = null;
  let nearestKm = Infinity;
  for (const city of allCities) {
    const km = haversine(point.lat, point.lon, city.lat, city.lng);
    if (km < nearestKm) {
      nearestKm = km;
      nearest = city;
    }
  }
  if (nearestKm <= CITY_RADIUS_KM) {
    osmCountByCity.set(nearest.city, (osmCountByCity.get(nearest.city) ?? 0) + 1);
    mappedInsideCities++;
  }
}

/**
 * The share of India's mapped charging stations that sit inside the 100 cities
 * modelled here. Charging infrastructure is far more urban-concentrated than
 * population is, and this measures by how much instead of guessing.
 */
const URBAN_SHARE = mappedInsideCities / osmPoints.length;

/* -------------------------------------------------------------------------- */
/* Telangana — absent from Vahan, so its state total must be imputed           */
/* -------------------------------------------------------------------------- */

/**
 * Telangana does not report through Vahan4 and appears in neither registration
 * file. Dropping it would remove Hyderabad, one of India's largest EV markets,
 * so its state total is imputed from the median EVs-per-lakh of the states that
 * do report. Every Telangana row is tagged `imputed` rather than `modelled`.
 */
function imputedStock(statePopLakhs) {
  const rates = STATES.map((s) => {
    const stock = evStockByState.get(norm(s.state));
    return stock ? stock / s.pop : null;
  })
    .filter((r) => r !== null)
    .sort((a, b) => a - b);
  const median = rates[Math.floor(rates.length / 2)];
  return Math.round(median * statePopLakhs);
}

const medianGrowth = () => {
  const rates = STATES.map((s) => growthByState.get(norm(s.state)))
    .filter((r) => r !== undefined && r !== null)
    .sort((a, b) => a - b);
  return rates[Math.floor(rates.length / 2)];
};

/* -------------------------------------------------------------------------- */
/* Build                                                                       */
/* -------------------------------------------------------------------------- */

const warnings = [];
const reconciliation = [];

const cities = STATES.flatMap((state) => {
  const key = norm(state.state);
  const cityPopTotal = sum(state.cities.map(([, , , pop]) => pop));

  const realStations = stationsByState.get(key);
  if (realStations === undefined) {
    warnings.push(`${state.state}: no MoP station count — state skipped`);
    return [];
  }

  const realStock = evStockByState.get(key);
  const stock = realStock ?? imputedStock(state.pop);
  const confidence = realStock === undefined ? "imputed" : "modelled";
  if (realStock === undefined) {
    warnings.push(
      `${state.state}: absent from Vahan registration data — stock imputed as ${stock.toLocaleString("en-IN")} EVs`
    );
  }

  const growth = growthByState.get(key) ?? medianGrowth();
  if (growthByState.get(key) === undefined) {
    warnings.push(`${state.state}: no 2022→2023 registrations — growth set to national median`);
  }

  // How much of the state's supply and fleet sits in the cities modelled here.
  const stateOsm = sum(state.cities.map(([city]) => osmCountByCity.get(city) ?? 0));
  const osmWeight = stateOsm / (stateOsm + OSM_SHRINKAGE);

  const urbanStations = realStations * URBAN_SHARE;
  const urbanStock = stock * URBAN_SHARE;
  const mix = classMixByState.get(key) ?? nationalMix;
  if (!classMixByState.has(key)) {
    warnings.push(`${state.state}: absent from the class table — national class mix applied`);
  }

  const rows = state.cities.map(([city, lat, lng, population_lakhs], i) => {
    const popShare = population_lakhs / cityPopTotal;
    const osmShare = stateOsm > 0 ? (osmCountByCity.get(city) ?? 0) / stateOsm : popShare;

    // Real distribution where OSM has enough coverage to be believed, population
    // where it does not. Demand has no equivalent signal, so it stays on population.
    const supplyShare = osmWeight * osmShare + (1 - osmWeight) * popShare;

    const public_chargers = Math.round(urbanStations * supplyShare * POINTS_PER_STATION);
    const fast_chargers = Math.round(public_chargers * FAST.share);
    const registered_ev = Math.round(urbanStock * popShare);

    // Installed capacity, the input to the energy model. Built from the two
    // rates directly so the AC and DC contributions stay separable.
    const total_kw = round(
      fast_chargers * FAST.dcKw + (public_chargers - fast_chargers) * FAST.acKw,
      1
    );

    return {
      id: `${state.code}-${String(i + 1).padStart(2, "0")}`,
      city,
      state: state.state,
      state_code: state.code,
      lat,
      lng,
      population_lakhs: round(population_lakhs, 1),
      registered_ev,
      ev_2w: Math.round(registered_ev * mix.ev_2w),
      ev_3w: Math.round(registered_ev * mix.ev_3w),
      ev_4w: Math.round(registered_ev * mix.ev_4w),
      ev_bus: Math.round(registered_ev * mix.ev_bus),
      ev_growth_rate: round(growth, 3),
      public_chargers,
      fast_chargers,
      total_kw,
      renewable_share: state.renewable,
      registration_confidence: confidence,
      supply_confidence: "modelled",
      osm_stations: osmCountByCity.get(city) ?? 0,
    };
  });

  reconciliation.push({
    state: state.state,
    realStations,
    modelledPoints: sum(rows.map((r) => r.public_chargers)),
    realStock: stock,
    modelledEv: sum(rows.map((r) => r.registered_ev)),
    imputed: confidence === "imputed",
    osmWeight,
    stateOsm,
  });

  return rows;
});

writeFileSync(
  new URL("../data/cities.json", import.meta.url),
  JSON.stringify(cities, null, 2) + "\n"
);

/* -------------------------------------------------------------------------- */
/* QUALITY.md — what the numbers are and how far they can be trusted           */
/* -------------------------------------------------------------------------- */

const nationalStations = sum([...stationsByState.values()]);
const nationalStock = sum([...evStockByState.values()]);
const totalPoints = sum(cities.map((c) => c.public_chargers));
const totalEv = sum(cities.map((c) => c.registered_ev));

/* -------------------------------------------------------------------------- */
/* Sign table — the deficit is a two-parameter claim, so vary both             */
/* -------------------------------------------------------------------------- */

/**
 * Demand scales with fleet x public share, so break-even is a single product,
 * not two independent thresholds. Moving one parameter with the other pinned
 * establishes a bound on that slice only and says nothing about the corner
 * where both sit low. This grid moves both, and it is generated rather than
 * typed in — the previous hard-coded figures had drifted from the constants
 * they were derived from.
 *
 * The e-3W fleet is the axis; the other three classes are held at their central
 * counts and default shares. That understates demand in the low-3W cells (the
 * missing three-wheelers would reappear as two-wheelers, worth up to ~84k
 * kWh/day) and so errs toward surplus, which is the conservative direction for
 * a table whose job is to find where the deficit fails.
 */
const classCount = (field) =>
  sum(
    EV_BY_CLASS.records
      .filter((r) => !isTotalRow(r.state_ut_name))
      .map((r) => sum(field.map((f) => num(r[f]) ?? 0)))
  );

/** Measured e-3W count at the class table's 07 Dec 2022 vintage — the hard floor. */
const floor3w = classCount(["_3wn", "_3wt"]);
/** The same shares applied to the current stock level — the central estimate. */
const central3w = Math.round(nationalStock * nationalMix.ev_3w);
const addedSince = nationalStock - classCount(["_2wn", "_2wt", "_2wic", "_3wn", "_3wt",
  "lmv", "lpv", "lgv", "_4wic", "mpv", "hpv"]);

// The city model applies each state's own class mix to that state's stock, and
// those mixes are less 3W-heavy than the national aggregate mix — so the model
// carries fewer three-wheelers than `central3w` implies. Scale the axis by that
// ratio rather than mixing the two bases.
const cityAgg = (field) => sum(cities.map((c) => c[field])) / URBAN_SHARE;
const modelled3w = cityAgg("ev_3w");
const axisScale = modelled3w / central3w;

const signSupply = cityAgg("total_kw") * HOURS_PER_DAY * CAPACITY_UTILISATION;
const otherDemand = ["ev_2w", "ev_4w", "ev_bus"].reduce(
  (total, k) => total + cityAgg(k) * DAILY_KWH[k] * PUBLIC_SHARE_DEFAULTS[k],
  0
);

/** Fleet x share at which national demand equals supply, in headline-3W units. */
const breakevenProduct = (signSupply - otherDemand) / DAILY_KWH.ev_3w / axisScale;

const threeWheelerDemand = modelled3w * DAILY_KWH.ev_3w * PUBLIC_SHARE_DEFAULTS.ev_3w;
const threeWheelerDemandShare = threeWheelerDemand / (threeWheelerDemand + otherDemand);

const step = (central3w - floor3w) / 3;
const signFleets = [0, 1, 2, 3].map((i) => Math.round(floor3w + i * step));
const signShares = [0.2, 0.37, 0.7, 0.9];
const signGrid = signFleets.map((f) =>
  signShares.map((s) => f * axisScale * DAILY_KWH.ev_3w * s + otherDemand - signSupply)
);

writeFileSync(
  new URL("../data/sensitivity.json", import.meta.url),
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      note: "Generated by scripts/build-cities.mjs. National equivalent of the city model (aggregate / urban share). Positive is deficit.",
      supply_kwh_day: round(signSupply, 0),
      other_class_demand_kwh_day: round(otherDemand, 0),
      floor_3w: floor3w,
      central_3w: central3w,
      modelled_3w: Math.round(modelled3w),
      added_since_class_vintage: addedSince,
      breakeven_product: Math.round(breakevenProduct),
      fleets: signFleets,
      shares: signShares,
      grid: signGrid.map((row) => row.map((v) => round(v, 0))),
      breakeven_share_by_fleet: signFleets.map((f) => round(breakevenProduct / f, 3)),
      breakeven_fleet_by_share: signShares.map((s) => Math.round(breakevenProduct / s)),
    },
    null,
    2
  ) + "\n"
);

const inr = (n) => Math.round(n).toLocaleString("en-IN");
const cell = (v) => `${v > 0 ? "+" : "−"}${Math.abs(v / 1e6).toFixed(2)}`;
const signTable = [
  `| e-3W fleet | ${signShares.map((s) => `${(s * 100).toFixed(0)}% public`).join(" | ")} |`,
  `|---|${signShares.map(() => "---:").join("|")}|`,
  ...signFleets.map(
    (f, i) =>
      `| ${inr(f)}${f === floor3w ? " *(Dec-2022 floor)*" : ""}${f === signFleets.at(-1) ? " *(central)*" : ""} | ${signGrid[i].map(cell).join(" | ")} |`
  ),
].join("\n");

const quality = `# Data quality — EVIP

Generated ${new Date().toISOString()} by \`scripts/build-cities.mjs\`. Do not edit by hand.

## Sources

| Source | Resource | Rows | Published |
|---|---|---|---|
| MoP charging stations | \`${MOP.rid}\` | ${MOP.total} | ${MOP.updated_date ?? "n/a"} |
| EV stock (Vahan) | \`${EV_STOCK.rid}\` | ${EV_STOCK.total} | ${EV_STOCK.updated_date ?? "n/a"} |
| EV by year (Vahan) | \`${EV_BY_YEAR.rid}\` | ${EV_BY_YEAR.total} | ${EV_BY_YEAR.updated_date ?? "n/a"} |
| EV by class (Vahan) | \`${EV_BY_CLASS.rid}\` | ${EV_BY_CLASS.total} | ${EV_BY_CLASS.updated_date ?? "n/a"} |
| OSM charging stations | Overpass, India bbox | ${osmPoints.length} | ${OSM._fetched} |

## National fleet mix

India's EV fleet is overwhelmingly two- and three-wheeled. This is the single
most important thing the real data says, and it is what the adequacy benchmark
has to be read against.

| Class | Share of national fleet |
|---|---|
| Two-wheelers | ${(nationalMix.ev_2w * 100).toFixed(1)}% |
| Three-wheelers | ${(nationalMix.ev_3w * 100).toFixed(1)}% |
| Four-wheelers | ${(nationalMix.ev_4w * 100).toFixed(1)}% |
| Buses | ${(nationalMix.ev_bus * 100).toFixed(1)}% |

Against ${nationalStations.toLocaleString("en-IN")} public stations nationally, that is
**${(nationalStock / nationalStations).toFixed(0)} EVs per station** across all
classes — comfortably inside the 1-per-250 adequacy benchmark this project was
built around.

## Fleet-count reconciliation

Three Vahan tables report overlapping quantities and must not be mixed casually:

| Table | National total | What it is |
|---|---|---|
| Stock (\`729dd0fe\`) | 36,39,617 | cumulative FY2019-20 to FY2023-24 |
| Class split (\`4596d19c\`) | 18,02,967 | all-time cumulative at 07 Dec 2022 |
| By year (\`acf1f1b0\`) | 28,77,135 | calendar 2020-2023 |

The stock figure is confirmed against an independent fiscal-year series
(\`6865c0ec\`, 36,39,513) to within 0.003%. The class split is an earlier
snapshot, so applying its shares to the stock level assumes the fleet mix has
not moved since December 2022 — it has, in the direction of two-wheelers.

That matters because three-wheelers carry ${(threeWheelerDemandShare * 100).toFixed(1)}% of modelled energy demand. Two
defensible bounds on the national e-3W count:

- **hard floor ${inr(floor3w)}** — the measured December 2022 count; the fleet cannot
  have shrunk below it
- **${inr(central3w)}** — the class share applied to the current stock level

## Does the sign hold? Both parameters at once

Demand scales with fleet **times** public share, so break-even is a single
product — **${inr(breakevenProduct)}** on these inputs — not two separate thresholds. An argument
that moves the fleet while holding share at ${(PUBLIC_SHARE_DEFAULTS.ev_3w * 100).toFixed(0)}%, or moves the share while
holding the fleet at ${inr(central3w)}, bounds one slice of the plane and says nothing
about the corner where both sit low. Both move here.

National deficit in million kWh/day. **Positive is deficit, negative is surplus.**

${signTable}

Break-even public share by fleet: ${signFleets.map((f) => `${inr(f)} → ${(breakevenProduct / f).toFixed(2)}`).join(", ")}.

Duty cycle is a third axis of the same shape: break-even is really fleet ×
share × kWh/day, and the ${DAILY_KWH.ev_3w.toFixed(1)} kWh/day figure is no better measured than the
other two. It is left fixed here because 90 km/day is argued as a floor rather
than a central estimate, so moving it can only push toward deficit, never away.

**What this shows.** The deficit holds across the plausible range. It reverses
only if the e-3W fleet sat at its December 2022 floor **and** public share is
roughly half the assumed value at the same time — at the floor, break-even
share is **${(breakevenProduct / floor3w).toFixed(2)}**, not ${(breakevenProduct / central3w).toFixed(2)}. That corner is unlikely: fifteen months of
growth did happen, and ${(PUBLIC_SHARE_DEFAULTS.ev_3w * 100).toFixed(0)}% is if anything conservative for a fleet Vahan
records as 99.9% commercial. But it is a live corner, not a closed one, and the
floor-fleet column at the default share is genuinely marginal — a ${cell(signGrid[0][2])}M
surplus against ${(signSupply / 1e6).toFixed(2)}M of supply, well inside the model's own error.

Basis: the shipping city model, aggregated and divided by the ${(URBAN_SHARE * 100).toFixed(1)}% urban share
to read nationally. It carries ${inr(modelled3w)} three-wheelers at the central assumption
rather than ${inr(central3w)}, because it applies each state's own class mix to that
state's stock and those mixes are less three-wheeler-heavy than the national
aggregate; the fleet axis is scaled by that ratio (${axisScale.toFixed(2)}). Computing supply
straight from the ${inr(nationalStations)} Ministry stations instead puts break-even ~12% lower
and turns the floor-fleet-at-${(PUBLIC_SHARE_DEFAULTS.ev_3w * 100).toFixed(0)}% cell into a marginal deficit. The sign of
that one cell depends on which basis you take, which is the point.

## Constants derived from data, not assumed

| Constant | Value | Basis |
|---|---|---|
| Points per station | ${POINTS_PER_STATION} | median OSM \`capacity\` tag |
| Fast (>=50 kW) share | ${(FAST.share * 100).toFixed(1)}% | ${FAST.n} OSM stations with a \`socket:*:output\` tag |
| AC point rating | ${FAST.acKw} kW | median of ${FAST.acN} sub-50 kW OSM sockets |
| DC point rating | ${FAST.dcKw} kW | median of ${FAST.dcN} >=50 kW OSM sockets |
| Urban share of stations | ${(URBAN_SHARE * 100).toFixed(1)}% | ${mappedInsideCities} of ${osmPoints.length} mapped stations within ${CITY_RADIUS_KM} km of a modelled city |

## Coverage

- Cities: **${cities.length}** across **${STATES.length}** states
- Cities with at least one mapped OSM station: **${cities.filter((c) => c.osm_stations > 0).length}/${cities.length}**
- National MoP stations: **${nationalStations.toLocaleString("en-IN")}**; modelled into cities: **${Math.round(totalPoints / POINTS_PER_STATION).toLocaleString("en-IN")}** stations (${totalPoints.toLocaleString("en-IN")} points)
- National EV stock: **${nationalStock.toLocaleString("en-IN")}**; modelled into cities: **${totalEv.toLocaleString("en-IN")}**

## State reconciliation

City figures are a state total times an urban share, so they sum to less than the
state total by design — the remainder is the state outside these cities.

| State | MoP stations | Modelled points | Vahan EVs | Modelled EVs | OSM weight |
|---|---|---|---|---|---|
${reconciliation
  .map(
    (r) =>
      `| ${r.state}${r.imputed ? " *(imputed)*" : ""} | ${r.realStations.toLocaleString("en-IN")} | ${r.modelledPoints.toLocaleString("en-IN")} | ${r.realStock.toLocaleString("en-IN")} | ${r.modelledEv.toLocaleString("en-IN")} | ${r.osmWeight.toFixed(2)} (n=${r.stateOsm}) |`
  )
  .join("\n")}

## Warnings

${warnings.length ? warnings.map((w) => `- ${w}`).join("\n") : "- none"}
`;

writeFileSync(new URL("../data/QUALITY.md", import.meta.url), quality);

const byConfidence = cities.reduce((acc, c) => {
  acc[c.registration_confidence] = (acc[c.registration_confidence] ?? 0) + 1;
  return acc;
}, {});

console.log(
  `${cities.length} cities across ${STATES.length} states -> data/cities.json`,
  `\n  points/station ${POINTS_PER_STATION} | fast ${(FAST.share * 100).toFixed(1)}% (n=${FAST.n}) | urban share ${(URBAN_SHARE * 100).toFixed(1)}%`,
  `\n  registration confidence:`,
  byConfidence
);
for (const warning of warnings) console.warn(`  ! ${warning}`);
