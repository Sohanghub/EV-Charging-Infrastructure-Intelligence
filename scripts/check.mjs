/**
 * Runnable self-check for the model: `npm run check`.
 * Covers the two places a silent error would be expensive — the priority score
 * and the integer allocation — plus the shape of the committed dataset.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AC_POINTS_PER_STATION,
  CHARGING_POINTS_PER_STATION,
  DAILY_KWH,
  FAST_POINTS_PER_STATION,
  PUBLIC_SHARE_DEFAULTS,
  RECOMMENDATION_POOL_SIZE,
  SLIDER_MAX_STATIONS,
  SLIDER_MIN_STATIONS,
  SLIDER_STEP_STATIONS,
  STATION_AC_KW,
  STATION_DC_KW,
} from "../lib/constants.ts";
import { allocateStations, summarizeImpact } from "../lib/allocation.ts";
import { buildExport, metricRows } from "../lib/export.ts";
import { METRICS } from "../lib/metrics.ts";
import {
  crossoverLabel,
  crossoverYear,
  demandKwhDay,
  rankByPriority,
  scoreCity,
  supplyKwhDay,
} from "../lib/scoring.ts";

const cities = JSON.parse(
  readFileSync(new URL("../data/cities.json", import.meta.url), "utf8")
);
// Not `cities.map(scoreCity)` — map passes the index as the second argument,
// which lands in `shares` and quietly produces NaN demand for every city.
const scored = cities.map((c) => scoreCity(c));

/* -- dataset -------------------------------------------------------------- */

assert.equal(new Set(cities.map((c) => c.id)).size, cities.length, "ids must be unique");
assert.ok(cities.length >= 90, "expected roughly 100 cities");
assert.ok(
  cities.every((c) => c.fast_chargers <= c.public_chargers),
  "fast_chargers is a subset of public_chargers"
);
// The four fabricated operational fields are gone for good. This asserts they
// stay gone rather than creeping back in through a future build script.
for (const dead of [
  "charger_utilization",
  "average_queue_minutes",
  "average_daily_sessions",
  "estimated_daily_demand",
]) {
  assert.ok(
    cities.every((c) => !(dead in c)),
    `${dead} was removed from the dataset and must not return`
  );
}
assert.ok(
  cities.every((c) => c.public_chargers === 0 || c.total_kw > 0),
  "any city with charging points must carry installed capacity"
);

/* -- scoring -------------------------------------------------------------- */

const base = {
  id: "XX-01", city: "Test", state: "Test", state_code: "XX", lat: 20, lng: 78,
  population_lakhs: 10, registered_ev: 100_000, ev_growth_rate: 0.5,
  ev_2w: 45_000, ev_3w: 51_000, ev_4w: 3_600, ev_bus: 400,
  public_chargers: 400, fast_chargers: 100, total_kw: 5000, renewable_share: 0.3,
  registration_confidence: "modelled", supply_confidence: "modelled", osm_stations: 12,
};

// Severity is a fixed ratio of demand to deliverable supply, not a percentile.
const scored0 = scoreCity(base);
assert.equal(
  scored0.deficit_kwh_day,
  scored0.demand_kwh_day - scored0.supply_kwh_day,
  "deficit is demand less supply"
);

const balanced = scoreCity({ ...base, total_kw: demandKwhDay(base) / (24 * 0.2) });
assert.ok(Math.abs(balanced.deficit_ratio - 1) < 1e-9, "break-even is a ratio of 1.0");
assert.equal(balanced.severity, "moderate", "break-even sits at the moderate cut point");
assert.equal(
  scoreCity({ ...base, total_kw: balanced.total_kw * 2 }).severity,
  "strong",
  "twice the capacity needed means supply covers demand"
);
assert.equal(
  scoreCity({ ...base, total_kw: balanced.total_kw / 2 }).severity,
  "critical",
  "half the capacity needed is demand at 2x supply"
);

// Halving capacity must raise priority, not lower it.
const starved = scoreCity({ ...base, total_kw: base.total_kw / 2 });
assert.ok(starved.priority_score > scored0.priority_score, "less supply => higher priority");

// Zero capacity: no division by zero, and it must outrank the starved city.
const empty = scoreCity({ ...base, public_chargers: 0, fast_chargers: 0, total_kw: 0 });
assert.ok(Number.isFinite(empty.priority_score), "zero capacity must not divide by zero");
assert.ok(empty.priority_score > starved.priority_score, "zero supply is the worst case");

// A city in surplus scores zero, never negative — spare capacity is not
// anti-priority, it is simply no claim on the next station.
assert.equal(
  scoreCity({ ...base, total_kw: 1_000_000 }).priority_score,
  0,
  "surplus floors at zero"
);

// Growth no longer touches the priority score at all — it lives in the
// projection, where a negative rate cannot invert anything.
assert.equal(
  scoreCity({ ...base, ev_growth_rate: -0.015 }).priority_score,
  scoreCity({ ...base, ev_growth_rate: 0.5 }).priority_score,
  "growth must not enter the priority score"
);

/* -- energy model --------------------------------------------------------- */

// A three-wheeler draws ~42x the public energy of a two-wheeler. Counting
// vehicles instead of energy is what inverted the national result, so this
// asymmetry is the thing most worth pinning down.
const perVehicle = (k) => DAILY_KWH[k] * PUBLIC_SHARE_DEFAULTS[k];
assert.ok(
  perVehicle("ev_3w") / perVehicle("ev_2w") > 40,
  "3W public draw must dwarf 2W — the whole reason the unit matters"
);

// Demand is linear in the share sliders and zero when nothing charges publicly.
const zeroShare = { ev_2w: 0, ev_3w: 0, ev_4w: 0, ev_bus: 0 };
assert.equal(demandKwhDay(base, zeroShare), 0, "no public share means no public demand");
assert.ok(
  Math.abs(
    demandKwhDay(base, { ...PUBLIC_SHARE_DEFAULTS, ev_3w: PUBLIC_SHARE_DEFAULTS.ev_3w * 2 }) -
      (demandKwhDay(base) + base.ev_3w * DAILY_KWH.ev_3w * PUBLIC_SHARE_DEFAULTS.ev_3w)
  ) < 1e-6,
  "demand is linear in the 3W share"
);

// Supply is capacity, not point count: two AC points != one DC point.
assert.equal(supplyKwhDay({ ...base, total_kw: 100 }), 100 * 24 * 0.2);

// The claim the kW pricing rests on: the DC pair carries the overwhelming
// majority of a station's capacity, so a build priced in points would be wrong
// by an order of magnitude. Asserted against the constants rather than assumed.
const stationKw =
  FAST_POINTS_PER_STATION * STATION_DC_KW + AC_POINTS_PER_STATION * STATION_AC_KW;
assert.ok(
  (FAST_POINTS_PER_STATION * STATION_DC_KW) / stationKw > 0.9,
  "the DC points must carry the bulk of a funded station's capacity"
);

/* -- sign table ----------------------------------------------------------- */

// The national deficit is a claim about a product, fleet x share, so the grid
// must behave like one: monotone in both directions, break-even reproducing
// from the product alone, and the corner the prose calls live actually live.
const sens = JSON.parse(
  readFileSync(new URL("../data/sensitivity.json", import.meta.url), "utf8")
);
for (const row of sens.grid)
  assert.ok(
    row.every((v, i) => i === 0 || v > row[i - 1]),
    "deficit must rise with public share"
  );
for (let col = 0; col < sens.shares.length; col++)
  assert.ok(
    sens.grid.every((row, i) => i === 0 || row[col] > sens.grid[i - 1][col]),
    "deficit must rise with fleet size"
  );
sens.fleets.forEach((fleet, i) => {
  const product = fleet * sens.breakeven_share_by_fleet[i];
  assert.ok(
    Math.abs(product - sens.breakeven_product) / sens.breakeven_product < 0.01,
    "every row's break-even share must recover the same fleet x share product"
  );
});
assert.ok(sens.grid.at(-1)[2] > 0, "central fleet at the 70% default is a deficit");
assert.ok(
  sens.grid[0][1] < 0,
  "fleet floor with a halved public share is a surplus — the corner the sign table exists to show"
);

// Crossover: already-deficit is 0, shrinking is null, growing lands in between.
const surplus = { ...base, total_kw: 1_000_000, ev_growth_rate: 0.3 };
const deficit = { ...base, total_kw: 1, ev_growth_rate: 0.3 };
assert.equal(crossoverYear(deficit), 0, "a city already short must cross at year 0");
assert.equal(
  crossoverYear({ ...surplus, ev_growth_rate: -0.015 }),
  null,
  "a shrinking fleet never crosses — the answer the old clamp destroyed"
);
const mid = crossoverYear({ ...base, total_kw: demandKwhDay(base) / (24 * 0.2) * 1.5 });
assert.ok(mid !== null && mid > 0, "a growing fleet with headroom crosses inside the horizon");

// Ranking is deterministic and does not mutate its input.
const order = rankByPriority(scored).map((c) => c.id);
assert.deepEqual(rankByPriority([...scored].reverse()).map((c) => c.id), order);
assert.notEqual(scored[0], undefined);

/* -- allocation ----------------------------------------------------------- */

for (let total = SLIDER_MIN_STATIONS; total <= SLIDER_MAX_STATIONS; total += SLIDER_STEP_STATIONS) {
  const allocations = allocateStations(scored, total);

  assert.equal(allocations.length, RECOMMENDATION_POOL_SIZE, `pool size at ${total}`);
  assert.equal(
    allocations.reduce((sum, a) => sum + a.stations, 0),
    total,
    `allocated stations must sum to exactly ${total}`
  );
  assert.ok(
    allocations.every((a) => Number.isInteger(a.stations) && a.stations >= 1),
    `every funded city gets a whole station at ${total}`
  );
  assert.ok(
    allocations.every((a) => a.charging_points === a.stations * CHARGING_POINTS_PER_STATION),
    `points track stations at ${total}`
  );
  assert.ok(
    allocations.every((a) => a.fast_points + a.ac_points === a.charging_points),
    `fast + AC split covers every point at ${total}`
  );
  assert.ok(
    allocations.every((a) => a.deficit_closure >= 0 && a.deficit_closure <= 1),
    `deficit closure stays a 0-1 decimal at ${total}`
  );
  // A funded station is 2 DC + 2 AC, and the DC pair carries ~95% of its
  // capacity. Counting points rather than kW would misprice a build badly.
  // The rates come from the constants rather than restated literals — build-cities
  // is what pins those constants to the OSM medians they claim to match.
  assert.ok(
    allocations.every(
      (a) =>
        Math.abs(
          a.added_kw - (a.fast_points * STATION_DC_KW + a.ac_points * STATION_AC_KW)
        ) < 1e-9
    ),
    `added capacity is priced by point type at ${total}`
  );
  assert.ok(
    allocations.every((a) => a.deficit_after >= 0),
    `outstanding deficit never goes negative at ${total}`
  );
}

// The top-priority city must never be out-funded by a lower-ranked one.
const ranked = allocateStations(scored, 250);
assert.equal(ranked[0].city.id, rankByPriority(scored)[0].id);
assert.equal(Math.max(...ranked.map((a) => a.stations)), ranked[0].stations);

// More money must close more of the gap.
const small = summarizeImpact(allocateStations(scored, 25));
const large = summarizeImpact(allocateStations(scored, 1000));
assert.equal(small.stations, 25);
assert.equal(large.charging_points, 1000 * CHARGING_POINTS_PER_STATION);
assert.ok(
  large.deficit_closure > small.deficit_closure,
  "more stations close more of the deficit"
);
assert.ok(
  large.added_kwh_day > small.added_kwh_day,
  "more stations deliver more energy"
);

// A city already in surplus reports full closure rather than NaN.
const surplusCity = allocateStations([scoreCity({ ...base, total_kw: 1_000_000 })], 25, 1);
assert.equal(surplusCity[0].deficit_closure, 1);
assert.equal(surplusCity[0].deficit_after, 0);


// A null crossover has two causes and must not be labelled with one word.
// Shrinking fleets never cross; deeply oversupplied growing ones just haven't
// crossed inside the horizon. Andhra Pradesh's cities are the second kind.
assert.equal(
  crossoverLabel({ ...base, ev_growth_rate: -0.015, total_kw: 1_000_000 }),
  "Fleet shrinking"
);
assert.equal(
  crossoverLabel({ ...base, ev_growth_rate: 0.003, total_kw: 1_000_000 }),
  "Beyond 10 years",
  "a growing but oversupplied city is not shrinking"
);
assert.equal(crossoverLabel({ ...base, total_kw: 1 }), "Already short");

/* -- export --------------------------------------------------------------- */

// The plotted value is produced by a `dataKey` accessor Recharts never writes
// back to the city, so an export that omits it silently loses the chart.
const growth = METRICS.growth_score;
const shrinking = scoreCity({ ...base, ev_growth_rate: -0.08 });
const [shrinkingRow] = metricRows([shrinking], growth);
assert.equal(shrinkingRow.value, 0, "the bar is the clamped score");
assert.ok(
  shrinkingRow.display.startsWith("-"),
  "the label is the raw rate — they diverge where clamping bites"
);

// The export must carry the parameters that produced it, unchanged.
const shares = { ...PUBLIC_SHARE_DEFAULTS, ev_3w: 0.35 };
const payload = buildExport("top-priority-score", { shares, state: "all" }, []);
assert.deepEqual(payload.params.shares, shares, "slider values must survive verbatim");
assert.ok(Number.isFinite(Date.parse(payload.generated_at)));

// Moving a slider must move the exported numbers, or the params are decoration.
const atDefaults = metricRows(
  rankByPriority(cities.map((c) => scoreCity(c))).slice(0, 10),
  METRICS.priority_score
);
const atLowShare = metricRows(
  rankByPriority(cities.map((c) => scoreCity(c, shares))).slice(0, 10),
  METRICS.priority_score
);
assert.notDeepEqual(
  atDefaults.map((r) => r.value),
  atLowShare.map((r) => r.value),
  "the same chart at different shares must export different rows"
);

console.log("check: dataset, scoring, allocation and export OK");
