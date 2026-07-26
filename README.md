# ECII — EV Charging Infrastructure Intelligence

**If investment is limited, where should India's next public charging stations be built?**

That is the only question this application exists to answer. It is not a dashboard. It is a
geospatial decision-support tool: it ranks 100 Indian cities by how much unmet charging
demand each existing charging point already carries, then splits a fixed station budget
across the places where new capacity would relieve the most pressure.

![ECII — national view of the charging shortfall](public/screenshot.png)

> Home page, light theme. Swap `public/screenshot.png` for your own capture at any time.

---

## The problem

India's EV fleet is growing far faster than the public charging network beneath it. A
national charger count looks reassuring; a per-city one does not. Two cities with identical
fleet sizes can be a decade apart in how long a driver waits to plug in.

In the modelled dataset:

- **1.38 crore registered EVs** across 100 cities and 20 states
- **42,135 public charging points**, of which about a third are DC fast
- **3.1 points per 1,000 EVs** nationally, against a benchmark of 4
- **65% of registered EVs** sit in cities below that benchmark

## Demand

Demand is not uniform, and neither is its growth. Karnataka, Maharashtra, Delhi, Tamil Nadu
and Telangana carry mature fleets growing at 25–45% a year. Gujarat, Uttar Pradesh,
Rajasthan and Madhya Pradesh are growing at 55–85% from a much thinner infrastructure base —
which is precisely the combination that produces queues.

The Explore page plots every city by fleet size against coverage, with the benchmark drawn
as a line. Everything below the line is under-served. Most cities are below the line.

## The infrastructure gap

Coverage is measured against one public charging point per **250 registered EVs**. A city's
**capacity gap** is the number of points it is short of that benchmark, and its **priority
score** is the unmet demand each existing point already carries:

```
base_score = registered_ev × ev_growth_rate × effective_utilization / max(public_chargers, 1)

priority_score = base_score × queue_multiplier      // up to 2.0×, maxes at 30-minute queues
                            × density_multiplier    // up to 2.0×, maxes at zero coverage
                            × population_multiplier // up to 1.5×, maxes at 200 lakh people
```

Every multiplier is bounded, so no single input can run away with the ranking. The
denominator is public charging points only — fast chargers are a subset of that count, and
adding them would double-count capacity.

Nationally the shortfall comes to **15,127 charging points**, and it is concentrated.

## Recommendations

Set a budget between 25 and 1,000 stations. Each station is a fixed 4-point site — 2 DC fast
and 2 AC. The stations are split across the fifteen highest-priority cities by the
**largest-remainder method**, with a floor of one station per city, so allocations are whole
numbers and always sum to exactly the budget.

At the default of 250 stations (1,000 charging points):

| Rank | City      | State          | Stations |
| ---: | --------- | -------------- | -------: |
|    1 | Jaipur    | Rajasthan      |       37 |
|    2 | Lucknow   | Uttar Pradesh  |       35 |
|    3 | Indore    | Madhya Pradesh |       26 |
|    4 | Ghaziabad | Uttar Pradesh  |       18 |
|    5 | Patna     | Bihar          |       17 |

That allocation closes **37%** of those cities' charger gap and cuts average peak waiting
time by **29%**. Waiting time is modelled as inversely proportional to the square root of
capacity, so added capacity has diminishing returns rather than linear ones. Every figure on
the page is recomputed from the allocation as the slider moves — none of them are written
down anywhere.

The Methodology page states all of this in full, including what the model cannot tell you.

---

## The data is synthetic

City names, coordinates, state assignments and populations are real. **Every EV count,
charger count, utilization, queue and demand figure is generated** from a fixed seed to be
plausible, not accurate. Public sources (Vahan, PM E-DRIVE, BEE, CEA) informed the shape of
the distributions and the benchmarks; no figure is copied from them. Nothing here should be
used to make an actual investment decision.

`data/cities.json` is the single source of truth. State-level aggregates are computed at
runtime in `lib/aggregate.ts`, so there is no second file to fall out of sync. That module
also validates the dataset on load — unique IDs, coordinates inside India,
`fast_chargers ≤ public_chargers`, rates as decimals, sessions never exceeding demand — and
fails the build with the offending record named.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run check   # asserts the scoring and allocation model
npm run lint
```

Regenerating the datasets — both outputs are committed, so this is only needed to reshape
them:

```bash
npm run data:cities   # rewrites data/cities.json from the seeded generator
npm run data:states   # rebuilds boundaries from Natural Earth
```

## How it is put together

```
app/
  page.tsx              Home — hero, computed headline figure, national map
  explore/              Filters, map, charts, comparison table, city dialog
  recommendations/      Slider, ranking, allocation and gap charts, cards
  methodology/          Definitions, formulas, allocation rule, limitations
components/
  map/india-map.tsx     The one map component; Home and Explore differ only by props
  map/map-canvas.tsx    The only file that touches Leaflet
lib/
  constants.ts          Every benchmark, threshold, cap and bound
  scoring.ts            Pure derived metrics and the priority score
  allocation.ts         Largest-remainder allocation and the impact model
  aggregate.ts          Dataset validation and runtime state roll-ups
  metrics.ts            One metric definition shared by selector, map, charts, table
data/
  cities.json           100 cities — the single source of truth
  india-states.json     Simplified state boundaries (GeoJSON)
  methodology.json      Static methodology copy
scripts/
  build-cities.mjs      Seeded dataset generator
  build-states-geojson.mjs
  check.mjs             Model self-check
```

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Recharts ·
React Leaflet · next-themes · Framer Motion.

Frontend only — no backend, no database, no authentication. The single runtime network
dependency is the CARTO basemap tiles; if they fail to load, markers and boundaries still
render.

## Licence

MIT. See [LICENSE](LICENSE).

Boundary geometry from [Natural Earth](https://www.naturalearthdata.com/) (public domain).
Map tiles © [CARTO](https://carto.com/attributions), data ©
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
