# EV Charging Infrastructure Intelligence (ECII)

> A premium geospatial decision-support platform that helps identify where India's EV charging infrastructure should be expanded to support rapidly growing electric vehicle adoption.

**Encoding:** This file is UTF-8. If tree or arrow characters render as `â”œ` / `â†’`, re-save the file as UTF-8 before handing it to any tool.

---

# Product Vision

This project is **not** an EV dashboard.

It is an infrastructure planning platform.

The user should leave the application able to answer one question:

> **If investment is limited, where should the next public charging stations be built?**

Every visualization, chart, map and recommendation should support answering that question.

Avoid creating "just another analytics dashboard."

---

# Design Philosophy

The application should feel like software used internally by infrastructure planners, transportation analysts, or product teams at:

- Google Maps
- Google Cloud
- Stripe
- Linear
- Vercel

Characteristics

- premium
- modern
- minimal
- information-dense
- spatial-first
- decision-oriented

Avoid

- marketing style dashboards
- gradients
- glassmorphism
- decorative illustrations
- unnecessary animations
- futuristic EV aesthetics (no neon, no circuit-board motifs, no glowing icons)

The product should feel like a planning tool, not a landing page.

---

# Scope

Frontend only.

No backend. No authentication. No database. No CRUD. No user-generated data.

Everything is powered by static JSON files, with one exception: map tiles load externally (see Map Rendering).

---

# Technology

Framework

- Next.js 15 (App Router)
- React 19
- TypeScript

Styling

- Tailwind CSS v4
- shadcn/ui
- next-themes

Charts

- Recharts

Mapping

- React Leaflet
- Leaflet

Animation

- Framer Motion (optional — see Motion section)

Icons

- Lucide React

---

# Application Structure

```
/
├── Home
├── Explore
├── Recommendations
└── Methodology
```

Persistent navigation.

Dark mode.

Responsive.

---

# Data Layer

Everything lives inside `/data`.

```
data/
    cities.json
    india-states.geojson
    methodology.json
```

`cities.json` is the **single source of truth**. State-level aggregates are computed at runtime from city records in `lib/aggregate.ts` — there is no separate `states.json`, so files can never drift out of sync.

No runtime fetching of data. Import JSON directly.

Generate realistic synthetic datasets. Approximately

- 20 states
- 100 cities

## Terminology (definitions are load-bearing — read first)

- **Charging point (charger):** a single connector/port. The atomic unit of supply.
- **Station:** a physical site containing one or more charging points.
- **One slider-funded station adds exactly 4 charging points:** 2 DC fast (≥ 50 kW) + 2 AC (7–22 kW). This is the standard unit everywhere in the app — scoring, allocation, and impact math.
- `public_chargers` = **total** public charging points in a city, all types.
- `fast_chargers` = the **subset** of `public_chargers` that are DC fast. Always `fast_chargers <= public_chargers`. Never add the two together — that double-counts.

## Schema

### `cities.json` — array of ~100 records

```ts
interface City {
  id: string;                    // "KA-01" — state_code + two-digit sequence
  city: string;                  // "Bengaluru"
  state: string;                 // "Karnataka" — must match boundary GeoJSON name
  state_code: string;            // "KA"
  lat: number;
  lng: number;

  population_lakhs: number;      // 1 lakh = 100,000 people

  registered_ev: number;         // total registered EVs (2W + 4W)
  ev_growth_rate: number;        // DECIMAL YoY: 0.62 means 62%, never 62

  public_chargers: number;       // total public charging points, all types
  fast_chargers: number;         // subset of public_chargers, DC >= 50 kW
  charger_utilization: number;   // DECIMAL 0–1: 0.72 means 72%
  average_queue_minutes: number; // peak-hour queue, 0–45
  average_daily_sessions: number;

  highways_nearby: number;       // km of national highway within city limits
  estimated_daily_demand: number; // charging sessions demanded per day
  renewable_share: number;       // DECIMAL 0–1, grid renewable share
}
```

### `methodology.json` — static content

```ts
interface Methodology {
  data_sources: { name: string; url: string; note: string }[];
  definitions: { term: string; definition: string }[];   // station, charger, benchmarks
  scoring_weights: { term: string; rationale: string }[];
  assumptions: string[];
  limitations: string[];
}
```

## Validation

`lib/aggregate.ts` runs assertions on module load (dev + build). Fail fast with a clear error naming the offending record.

- `id` values unique
- coordinates inside India bbox: lat 6–36, lng 68–98
- `registered_ev > 0`, `population_lakhs > 0`
- `fast_chargers <= public_chargers`
- `0 <= charger_utilization <= 1`, `0 <= renewable_share <= 1`
- `0.05 <= ev_growth_rate <= 0.85`
- `average_daily_sessions <= estimated_daily_demand`
- if `public_chargers === 0` then `charger_utilization === 0` and `average_daily_sessions === 0`

## Realistic trends

High EV adoption

- Karnataka
- Maharashtra
- Delhi
- Tamil Nadu
- Telangana

Growing demand but infrastructure gaps

- Gujarat
- Uttar Pradesh
- Rajasthan
- Madhya Pradesh

Charger density targets (expressed as `public_chargers` per 1,000 EVs)

- Strong (Bengaluru, Pune, Hyderabad, Kochi): 4–6 per 1,000
- Moderate (Delhi, Mumbai, Chennai): 2–4 per 1,000
- Critical (Lucknow, Jaipur, Indore, Bhubaneswar, Patna): below 2 per 1,000

---

# Map Rendering

`cities.json` contains points, not polygons. The geographic base layer comes from external sources — this is the **only** permitted runtime network dependency.

## Tiles

- Light theme: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`
- Dark theme: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Switch tile layer when the resolved theme (next-themes) changes.
- If tiles fail to load, markers and boundaries must still render. No error UI.

## State boundaries

- Bundle a simplified India states GeoJSON at `data/india-states.geojson` and import it directly (static import, no network request).
- Match GeoJSON features to data by state name: property `NAME_1` or `st_nm`, compared case-insensitively and trimmed.
- Memoize the derived name→feature lookup with `useMemo` — build it once, share across pages.
- If a state name has no matching feature, skip that boundary polygon silently. Markers alone are acceptable.

## Hard constraints

- Load one client-only `IndiaMap` wrapper via `next/dynamic` with `{ ssr: false }`; its inner Leaflet components load normally.
- Import `leaflet/dist/leaflet.css` inside the map component.
- Keep the attribution control visible at all times: `© OpenStreetMap contributors © CARTO`.
- **Never use default Leaflet `Marker` icons** — bundlers break the icon asset paths. Use `CircleMarker` and `L.divIcon` only.
- Map containers need explicit heights (e.g. `h-[420px] md:h-[560px]`).

---

# Derived Metrics

Compute in `/lib/scoring.ts`. Pure functions. No side effects. Full float precision internally — rounding happens only at display.

**Units are non-negotiable:** rates are decimals (`0.62`, not `62`). Display conversion (`× 100`) happens in `lib/format.ts` only.

```ts
chargers_per_1000_ev =
  public_chargers / (registered_ev / 1000)
  // registered_ev > 0 guaranteed by validation

// Adequacy benchmark: 1 charger per 250 EVs → 4 per 1,000
// Range: [0, 1]. 1 = at or above benchmark.
coverage_score = clamp(chargers_per_1000_ev / 4, 0, 1)

// Saturation threshold: 80% utilization
// Range: [0, 1]. 1 = at or above 80% (saturated).
utilization_score = clamp(charger_utilization / 0.8, 0, 1)

// Absolute shortfall vs the 1-per-250-EV benchmark, in charging points.
capacity_gap = max(0, (registered_ev / 250) - public_chargers)

// Range: [0, 1]. 60% YoY growth = max score.
// Standalone Explore metric (metric selector / charts) — not a priority_score input.
growth_score = clamp(ev_growth_rate / 0.6, 0, 1)
```

## Priority Score

```
base_score =
  (registered_ev × ev_growth_rate × effective_utilization)
  / max(public_chargers, 1)

priority_score =
  base_score
  × queue_multiplier
  × density_multiplier
  × population_multiplier

where
  queue_multiplier      = 1 + clamp(average_queue_minutes / 30, 0, 1)   // up to 2× at 30+ min queues
  density_multiplier    = 1 + (1 - coverage_score)                      // up to 2× at zero coverage
  population_multiplier = 1 + clamp(population_lakhs / 200, 0, 0.5)     // up to 1.5× at 200L+ population
```

Notes

- The denominator is `public_chargers` **only**. `fast_chargers` is a subset and must never be added to it.
- All multipliers are bounded, so the score cannot explode.

## Edge cases

- **Zero chargers:** denominator clamped to `max(public_chargers, 1)`. A city with zero chargers scores as if it had one — worst case, not infinity.
- **Zero-charger utilization:** `effective_utilization = public_chargers === 0 ? 1 : charger_utilization`. The source utilization remains `0`; only scoring treats the city as maximum unmet demand.
- **Rounding (display only):** scores → 1 decimal. Percentages → whole number. Rates → 1 decimal.
- **Tie-breaking:** `priority_score` desc → `capacity_gap` desc → `city` name asc. Rankings must be deterministic.

---

# Allocation Rule

How the "N stations" are distributed on the Recommendations page. Exact, integer-only, and the sum always equals the slider value.

- **Slider:** range 25–1,000, step 25, default 250.
- **Unit:** 1 station = 4 charging points (2 DC fast + 2 AC). All impact math converts stations to charging points first.
- **Pool:** top 15 cities by `priority_score`.
- **Algorithm (largest-remainder method):**
  1. Give each of the top 15 cities a minimum of 1 station.
  2. `remaining = total − 15`.
  3. `raw_i = (priority_i / Σpriority) × remaining`.
  4. Floor every `raw_i`.
  5. Distribute leftover units one at a time to the largest fractional remainders.

## Impact math (transparent assumptions — documented on the Methodology page)

Waiting time (queue scales inversely with capacity, with diminishing returns):

```
new_queue_i = average_queue_minutes × √(public_chargers / (public_chargers + allocated_i × 4))
wait_reduction_i = average_queue_minutes > 0
  ? round((1 − new_queue_i / average_queue_minutes) × 100)
  : 0
```

Accessibility (gap closure toward the 1-per-250-EV benchmark, bounded 0–100%):

```
benchmark_i  = registered_ev / 250
gap_before_i = max(0, benchmark_i − public_chargers)
gap_after_i  = max(0, benchmark_i − (public_chargers + allocated_i × 4))
gap_closure_i = gap_before_i > 0 ? (gap_before_i − gap_after_i) / gap_before_i : 1
```

Dynamic summary sentence — **computed from the data, never hardcoded**:

> "Deploying 250 stations (1,000 charging points) across these 15 cities closes {X}% of the charger gap (weighted by allocation) and cuts average peak waiting time by {Y}%."

where X = weighted average of `gap_closure_i` and Y = weighted average of `wait_reduction_i` across the top 15, both weighted by `allocated_i`.

---

# User Journey

## Home

Purpose

Introduce India's EV infrastructure challenge.

Contains

Hero

> Where Will India Need Its Next Charging Station?

Supporting copy

One hero metric — **computed from `cities.json` at runtime**, e.g.

> "42% of registered EVs are in cities below the 1-per-250 charger benchmark."

CTA

Interactive India map (shared `IndiaMap`, `colorBy="gap"`)

Footer navigation cards

The hero map should immediately communicate charging shortages.

## Explore

Purpose

Understand demand vs supply.

Layout

```
Filters

Map | Charts

Comparison Table
```

Features

- State filter
- Metric selector
- Map visualization (shared `IndiaMap`, `colorBy` driven by metric selector)
- Charts
- Comparison table
- City detail dialog

Charts respond instantly to filters.

## Recommendations

Purpose

Recommend infrastructure investment.

This is the flagship experience.

Headline

> If funding allowed 250 new charging stations, where should they be installed?

Contains

- Investment slider (25–1,000, step 25, default 250)
- Ranking table (top 15, per the Allocation Rule)
- Infrastructure allocation chart
- Gap analysis (capacity_gap before vs after allocation)
- Recommendation cards
- Dynamic summary (per the Impact math — computed, never hardcoded)

Everything updates instantly. No loading states. All numbers derive from the Allocation Rule — no hand-tuned values.

## Methodology

Purpose

Increase trust.

Explain

- datasets
- definitions (station vs charging point, benchmarks: 1 per 250 EVs, 80% saturation)
- scoring formula and multiplier ranges
- allocation algorithm (largest-remainder)
- impact assumptions (square-root queue model, gap closure)
- a prominent notice that all city metrics and recommendations are synthetic and illustrative
- limitations

Keep visuals minimal. Text first.

---

# Components

Shared (reusable, typed props)

```
Navbar
Footer
ThemeProvider
PageTransition
IndiaMap          // configurable: colorBy mode, marker size metric,
                  // onSelect callback, height — used directly by Home and Explore
KPICard
SectionHeading
```

Home

```
HeroSection
QuickLinks
```

Explore

```
FilterBar
InfrastructureCharts
ComparisonTable
CityDialog
```

Recommendations

```
InvestmentSlider
PriorityTable
AllocationChart
RecommendationCards
```

There is **one** `IndiaMap` component, configurable via props. Do not create `HomeMap` / `ExploreMap` wrappers unless their behavior genuinely diverges during implementation — a `colorBy` prop and an `onSelect` callback cover both pages.

Shared components must be reusable with typed props. Page-specific components stay colocated with their page — do not force abstraction where it does not earn its keep.

---

# Visual Language

Container

```
max-w-7xl
```

Typography

Inter.

Whitespace

Generous.

Maps dominate the layout.

Tables

Sticky headers. Sortable. Comfortable density.

Charts

Minimal. Clear labels. Consistent color palette.

---

# Colors

Light

- Background: White
- Text: Slate
- Demand: Blue
- Infrastructure: Emerald
- Warning: Amber
- Critical: Red

Dark

- Slate 950 background
- Slate 100 text

No gradients.

---

# Motion

Subtle. Fast. Professional.

Implement motion with **CSS transitions first** (hover elevation, fades, focus states). Framer Motion is reserved for the two things CSS does poorly:

- page transitions (AnimatePresence)
- staggered card reveals

If a motion can be done with a Tailwind `transition-*` class, do it there.

---

# Folder Structure

```
app/
components/
hooks/
lib/
data/
public/
```

Organize by feature. Keep files small.

---

# Quality Requirements

Code should be

- modular
- readable
- fully typed

Avoid duplication. Extract utility functions. No inline magic numbers — named constants in `lib/constants.ts` (charger-per-station count, fast/AC split, density benchmark, saturation threshold, slider bounds, multiplier caps, severity thresholds).

---

# Performance

- Leaflet loaded dynamically with `ssr: false`.
- Static JSON only for data.
- Boundary GeoJSON imported from the static data bundle.
- No unnecessary renders — memoize derived metric arrays.
- Responsive charts via `ResponsiveContainer`.

---

# Accessibility

- Semantic HTML.
- Keyboard navigation.
- Visible focus indicators.
- Accessible contrast.
- Keyboard-friendly dialogs and tooltips.
- Slider operable via arrow keys (native `input[type=range]` under the hood).

---

# Deliverables

Repository includes

- complete source
- synthetic datasets
- README
- screenshot placeholder
- MIT license

README should tell the story

Problem → Demand → Infrastructure Gap → Recommendations

instead of listing framework features.

---

# Success Criteria

The product should feel like software used by transportation planners, urban development teams, or mapping companies.

A recruiter should understand the product within 30 seconds.

The application should communicate one clear message:

> **"This platform identifies where future EV charging infrastructure would create the greatest public impact."**

---

# Implementation Order

1. Project setup
2. Global layout
3. Theme system
4. Shared components
5. Synthetic datasets + validation
6. Map integration (tiles, boundaries, SSR-safe wrapper)
7. Home page
8. Explore page
9. Recommendation engine (scoring + allocation + impact math)
10. Methodology page
11. Animations
12. Responsive design
13. Polish
14. README

---

# Non-Goals

Do **not** implement

- authentication
- user accounts
- CRUD
- backend
- APIs
- AI
- notifications
- admin dashboard
- live charging station APIs
- payment flows
- route planning
- geocoding
- self-hosted map tiles

Keep the scope focused on producing a polished, static decision-support platform that showcases geospatial analysis, infrastructure planning, and modern frontend engineering.

