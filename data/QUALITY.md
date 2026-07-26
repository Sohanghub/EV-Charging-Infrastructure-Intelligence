# Data quality — EVIP

Generated 2026-07-26T12:57:06.414Z by `scripts/build-cities.mjs`. Do not edit by hand.

## Sources

| Source | Resource | Rows | Published |
|---|---|---|---|
| MoP charging stations | `34609614-1e3f-4fc6-b5c5-e05f1c8ec362` | 37 | 2026-02-25T05:45:53Z |
| EV stock (Vahan) | `729dd0fe-a438-49eb-9766-9cdb0ea4b4e2` | 36 | 2025-03-05T12:33:47Z |
| EV by year (Vahan) | `acf1f1b0-265b-4693-b58b-4ffc62b8101c` | 34 | 2025-03-27T21:49:48Z |
| EV by class (Vahan) | `4596d19c-fdfc-4bec-99d2-99e64f9ae3b1` | 35 | 2025-10-10T08:11:42Z |
| OSM charging stations | Overpass, India bbox | 657 | 2026-07-26T06:22:40.698Z |

## National fleet mix

India's EV fleet is overwhelmingly two- and three-wheeled. This is the single
most important thing the real data says, and it is what the adequacy benchmark
has to be read against.

| Class | Share of national fleet |
|---|---|
| Two-wheelers | 45.2% |
| Three-wheelers | 51.0% |
| Four-wheelers | 3.6% |
| Buses | 0.2% |

Against 25,852 public stations nationally, that is
**141 EVs per station** across all
classes — comfortably inside the 1-per-250 adequacy benchmark this project was
built around.

## Fleet-count reconciliation

Three Vahan tables report overlapping quantities and must not be mixed casually:

| Table | National total | What it is |
|---|---|---|
| Stock (`729dd0fe`) | 36,39,617 | cumulative FY2019-20 to FY2023-24 |
| Class split (`4596d19c`) | 18,02,967 | all-time cumulative at 07 Dec 2022 |
| By year (`acf1f1b0`) | 28,77,135 | calendar 2020-2023 |

The stock figure is confirmed against an independent fiscal-year series
(`6865c0ec`, 36,39,513) to within 0.003%. The class split is an earlier
snapshot, so applying its shares to the stock level assumes the fleet mix has
not moved since December 2022 — it has, in the direction of two-wheelers.

That matters because three-wheelers carry 92.2% of modelled energy demand. Two
defensible bounds on the national e-3W count:

- **hard floor 9,19,025** — the measured December 2022 count; the fleet cannot
  have shrunk below it
- **18,57,068** — the class share applied to the current stock level

## Does the sign hold? Both parameters at once

Demand scales with fleet **times** public share, so break-even is a single
product — **7,13,292** on these inputs — not two separate thresholds. An argument
that moves the fleet while holding share at 70%, or moves the share while
holding the fleet at 18,57,068, bounds one slice of the plane and says nothing
about the corner where both sit low. Both move here.

National deficit in million kWh/day. **Positive is deficit, negative is surplus.**

| e-3W fleet | 20% public | 37% public | 70% public | 90% public |
|---|---:|---:|---:|---:|
| 9,19,025 *(Dec-2022 floor)* | −2.38 | −1.68 | −0.31 | +0.51 |
| 12,31,706 | −2.10 | −1.16 | +0.67 | +1.78 |
| 15,44,387 | −1.82 | −0.64 | +1.66 | +3.05 |
| 18,57,068 *(central)* | −1.54 | −0.12 | +2.64 | +4.31 |

Break-even public share by fleet: 9,19,025 → 0.78, 12,31,706 → 0.58, 15,44,387 → 0.46, 18,57,068 → 0.38.

Duty cycle is a third axis of the same shape: break-even is really fleet ×
share × kWh/day, and the 5.4 kWh/day figure is no better measured than the
other two. It is left fixed here because 90 km/day is argued as a floor rather
than a central estimate, so moving it can only push toward deficit, never away.

**What this shows.** The deficit holds across the plausible range. It reverses
only if the e-3W fleet sat at its December 2022 floor **and** public share is
roughly half the assumed value at the same time — at the floor, break-even
share is **0.78**, not 0.38. That corner is unlikely: fifteen months of
growth did happen, and 70% is if anything conservative for a fleet Vahan
records as 99.9% commercial. But it is a live corner, not a closed one, and the
floor-fleet column at the default share is genuinely marginal — a −0.31M
surplus against 3.70M of supply, well inside the model's own error.

Basis: the shipping city model, aggregated and divided by the 61.9% urban share
to read nationally. It carries 15,48,112 three-wheelers at the central assumption
rather than 18,57,068, because it applies each state's own class mix to that
state's stock and those mixes are less three-wheeler-heavy than the national
aggregate; the fleet axis is scaled by that ratio (0.83). Computing supply
straight from the 25,852 Ministry stations instead puts break-even ~12% lower
and turns the floor-fleet-at-70% cell into a marginal deficit. The sign of
that one cell depends on which basis you take, which is the point.

## Constants derived from data, not assumed

| Constant | Value | Basis |
|---|---|---|
| Points per station | 2 | median OSM `capacity` tag |
| Fast (>=50 kW) share | 21.4% | 28 OSM stations with a `socket:*:output` tag |
| AC point rating | 3.3 kW | median of 22 sub-50 kW OSM sockets |
| DC point rating | 60 kW | median of 6 >=50 kW OSM sockets |
| Urban share of stations | 61.9% | 407 of 657 mapped stations within 25 km of a modelled city |

## Coverage

- Cities: **100** across **20** states
- Cities with at least one mapped OSM station: **41/100**
- National MoP stations: **25,852**; modelled into cities: **15,467** stations (30,933 points)
- National EV stock: **36,39,617**; modelled into cities: **22,68,549**

## State reconciliation

City figures are a state total times an urban share, so they sum to less than the
state total by design — the remainder is the state outside these cities.

| State | MoP stations | Modelled points | Vahan EVs | Modelled EVs | OSM weight |
|---|---|---|---|---|---|
| Karnataka | 1,972 | 2,443 | 3,50,810 | 2,17,321 | 0.72 (n=51) |
| Maharashtra | 2,010 | 2,491 | 4,39,358 | 2,72,174 | 0.71 (n=49) |
| Delhi | 358 | 443 | 2,16,084 | 1,33,861 | 0.88 (n=145) |
| Tamil Nadu | 2,434 | 3,016 | 2,28,850 | 1,41,768 | 0.55 (n=24) |
| Telangana *(imputed)* | 1,313 | 1,627 | 1,06,307 | 65,856 | 0.13 (n=3) |
| Gujarat | 1,470 | 1,821 | 1,91,185 | 1,18,436 | 0.09 (n=2) |
| Uttar Pradesh | 2,901 | 3,594 | 6,65,247 | 4,12,109 | 0.41 (n=14) |
| Rajasthan | 1,901 | 2,355 | 2,33,503 | 1,44,651 | 0.05 (n=1) |
| Madhya Pradesh | 1,328 | 1,646 | 1,44,782 | 89,690 | 0.13 (n=3) |
| Kerala | 834 | 1,034 | 1,51,029 | 93,559 | 0.75 (n=60) |
| West Bengal | 1,276 | 1,581 | 69,220 | 42,881 | 0.51 (n=21) |
| Andhra Pradesh | 1,309 | 1,622 | 88,534 | 54,846 | 0.47 (n=18) |
| Punjab | 1,064 | 1,319 | 56,459 | 34,975 | 0.05 (n=1) |
| Haryana | 1,287 | 1,594 | 81,775 | 50,658 | 0.31 (n=9) |
| Bihar | 818 | 1,013 | 2,14,921 | 1,33,140 | 0.00 (n=0) |
| Odisha | 893 | 1,106 | 97,056 | 60,124 | 0.09 (n=2) |
| Assam | 518 | 642 | 1,50,617 | 93,304 | 0.00 (n=0) |
| Jharkhand | 458 | 566 | 47,400 | 29,363 | 0.13 (n=3) |
| Chhattisgarh | 571 | 708 | 80,348 | 49,774 | 0.00 (n=0) |
| Uttarakhand | 252 | 312 | 48,522 | 30,059 | 0.05 (n=1) |

## Warnings

- Telangana: absent from Vahan registration data — stock imputed as 1,06,307 EVs
- Telangana: no 2022→2023 registrations — growth set to national median
- Telangana: absent from the class table — national class mix applied
