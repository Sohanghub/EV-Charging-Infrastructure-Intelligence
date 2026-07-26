# INGEST_LIVE_DATA.md — EVIP

**EV Charging Gap & Growth · live data acquisition**

Budget: **60 minutes** for acquisition, **45 minutes** for conform + validate. Hard stops.

Build ERIP's ingest first — the Overpass client, the data.gov.in client and the city matcher are all shared, so this one is mostly configuration.

---

## 1. What "live" means here

The Ministry of Power charging-station dataset updates periodically; Vahan registrations publish monthly; OSM changes continuously. Nothing streams.

"Live" here means:

1. **Fetched from source at run time**, not a vendored sample CSV
2. **Reproducible** — `rm -rf data/ && make ingest` rebuilds everything
3. **Scheduled refresh** — a *weekly* GitHub Action (faster than ERIP's monthly, because charging infrastructure genuinely moves), which commits changed JSON and triggers a Vercel redeploy

The refresh cadence difference between the two apps is itself a small signal worth a line in the README: cadence should follow the data, not a habit.

---

## 2. Tech stack

Identical to ERIP by design, plus one addition.

| Concern | Choice | Why |
|---|---|---|
| HTTP | **httpx** | Mandatory timeouts, HTTP/2 |
| Retries | **tenacity** | data.gov.in and Overpass both rate-limit |
| Dataframes | **pandas** | ~150 rows |
| SQL | **DuckDB** | ANSI SQL, zero setup |
| Validation | **pandera** | Catches renamed columns and swapped coordinates |
| Fuzzy matching | **rapidfuzz** | City reconciliation across three sources |
| **Connector parsing** | **regex + a unit test** | ← the EVIP-specific problem, §7 |
| Storage | **Parquet** | Typed, compressed |
| Orchestration | **Makefile + GitHub Actions** | Four sources. Airflow would be a red flag. |

```
httpx tenacity pandas duckdb pandera rapidfuzz pyarrow
```

Note there's no PDF library here — the EV sources are all structured. This is the easier ingest of the two, which is why it's the second build.

---

## 3. Shared ingest package

Import from `packages/ingest_common/`, unchanged:

```python
from ingest_common.datagov  import fetch_resource
from ingest_common.overpass import fetch_amenity      # amenity="charging_station"
from ingest_common.cities   import match_cities, normalise
from ingest_common.validate import write_quality_report
```

ERIP calls `fetch_amenity(..., amenity="hospital")`; EVIP calls it with `amenity="charging_station"`. Same client, one parameter. That's the shared-engine story extended into the data layer — worth one line in the README.

---

## 4. Directory contract

```
apps/evip/
├── data/
│   ├── raw/
│   │   ├── mop_charging_stations.csv
│   │   ├── ev_registrations_state.csv
│   │   ├── worldcities.csv
│   │   └── osm/hyderabad.json …
│   ├── manual/
│   │   ├── city_aliases.csv
│   │   └── connector_overrides.csv   ← unparseable connector strings
│   ├── processed/{cities,analysis}.parquet
│   └── SOURCES.md
└── analysis/{ingest,prepare,export}.py + config.py + sql/build.sql
```

Same rule as ERIP: `ingest.py` writes only to `raw/` and never transforms; `prepare.py` reads only `raw/` and never fetches.

---

## 5. Source 1 — Ministry of Power charging stations

**The one source that must work.** State, district, city and location-wise public charging stations, with charger types, charger ratings, connector ratings and connector counts.

Available through data.gov.in (and mirrored on Dataful). Search the catalogue, copy the resource ID from the URL, verify it on the portal.

```python
from ingest_common.datagov import fetch_resource

rows = fetch_resource(rid=MOP_RESOURCE_ID, api_key=os.environ["DATA_GOV_API_KEY"])
pd.DataFrame(rows).to_csv("data/raw/mop_charging_stations.csv", index=False)
```

**Known issues to record in `SOURCES.md`:**
- The dataset has published errata, including at least one district assigned to the wrong state. Check state–district consistency and note any corrections you apply.
- Column names vary between releases. `strict=True` in the pandera schema will catch this on the next refresh, which is exactly what it's for.
- Rows are per *station*, not per city — aggregate.

---

## 6. Source 2 — EV registrations

State/UT-level EV registration counts by vehicle class from data.gov.in.

```python
reg = fetch_resource(rid=EV_REG_RESOURCE_ID, api_key=KEY)
```

**Do not scrape the Vahan dashboard.** It's a JavaScript cross-tab requiring browser automation — a multi-hour job for resolution you can approximate. District-level registrations are the better input; they are not worth the hours this week. Put it in future work.

### Disaggregation to cities — a modelled step, labelled as such

```python
# city share of state population → city share of state registrations
city["pop_share"] = city.population / city.groupby("state").population.transform("sum")

for cls in ("2w", "3w", "4w", "bus"):
    city[f"ev_{cls}"] = (
        city.state.map(state_reg.set_index("state")[cls]) * city.pop_share
    ).round().astype(int)

city["registration_confidence"] = "modelled"
```

Every row carries `registration_confidence = 'modelled'`, and the UI must render it distinctly. This assumption — that EV adoption within a state tracks population — is wrong in a knowable direction: metros over-index. Say so in the limitations rather than hoping nobody asks.

---

## 7. Connector parsing — the EVIP-specific time sink

The supply model needs `total_kw` per city. The source gives free-text charger and connector fields with inconsistent formatting. Budget **30 minutes**, no more.

```python
import re
import pandas as pd

_KW = re.compile(r"(\d+(?:\.\d+)?)\s*(?:kw|kilowatt)", re.I)

def parse_kw(text: str) -> float | None:
    """Extract a power rating in kW from a free-text charger field."""
    if not isinstance(text, str):
        return None
    hits = [float(m) for m in _KW.findall(text)]
    return max(hits) if hits else None      # a station lists several; take the rated max

def station_kw(row) -> float:
    kw = parse_kw(row.charger_rating) or parse_kw(row.connector_rating)
    n  = pd.to_numeric(row.no_of_connectors, errors="coerce")
    if kw is None or pd.isna(n):
        return float("nan")                  # flows to the override file, not to 0
    return kw * n
```

**Two rules that keep this from eating your morning:**

Never default an unparseable rating to zero. A silent zero understates supply and inflates the deficit for that city, which corrupts the ranking invisibly. Send failures to `data/manual/connector_overrides.csv` — a committed file of `station_id, kw` that you fill in by hand for the worst offenders.

Track the parse rate and report it:

```python
parse_rate = df.total_kw.notna().mean()
print(f"connector parse rate: {parse_rate:.1%}")
if parse_rate < 0.80:
    print("→ fall back to n_stations × DEFAULT_STATION_KW, document in README")
```

Below 80%, take the fallback and move on. A documented approximation is fine; a silent one is not. Either way the number goes in `QUALITY.md`, and reporting a parse rate at all is the kind of detail that reads as real data engineering.

Write three unit tests for `parse_kw` against real strings from the file. Five minutes, and it stops a regex tweak from silently changing every city's supply.

---

## 8. Source 3 — coordinates

Same SimpleMaps *World Cities* CSV as ERIP (CC BY 4.0, attribution required). Match MoP city names against it with the shared matcher:

```python
from ingest_common.cities import match_cities

mapping, unmatched = match_cities(mop.city, cities.city_ascii)
if unmatched:
    raise ValueError(
        f"{len(unmatched)} cities unmatched: {unmatched[:20]}\n"
        f"Add them to data/manual/city_aliases.csv and re-run."
    )
```

**Expect more unmatched names than in ERIP.** MoRTH covers ~50 well-known million-plus cities; the MoP dataset includes smaller towns with inconsistent spellings. Two mitigations:

- Filter to cities above a population floor *before* matching — you probably don't need every town with two chargers, and the deficit metric is meaningless where registrations are rounding error.
- Budget 10 minutes for the alias tail. It's committed as documentation of exactly what you resolved.

---

## 9. Source 4 — OSM cross-check (optional, 15 min)

```python
from ingest_common.overpass import fetch_amenity
osm = fetch_amenity(city, lat, lon, amenity="charging_station")
```

Not needed for the model. Worth it for one chart: **station counts per city from MoP vs. OSM vs. BEE e-Yatra**. The three sources will disagree, sometimes substantially.

That disagreement is a genuine finding, not a problem — it quantifies how uncertain India's public charging inventory actually is, and it justifies the confidence tiers you're already carrying. Fifteen minutes for a scatter plot that makes the whole analysis look more honest.

Cut it if you're behind at minute 45.

---

## 10. Derived columns (stage ③)

```sql
-- analysis/sql/build.sql  (ANSI — Postgres-portable)
CREATE TABLE analysis AS
SELECT
  city, state, lat, lon, population,
  ev_2w, ev_3w, ev_4w, ev_bus,
  n_stations, n_connectors, total_kw,
  registration_confidence
FROM cities
WHERE population >= 200000;
```

Note what is *not* here: `demand_kwh_day`, `supply_kwh_day`, `deficit`, `crossover_year`. All four depend on slider parameters (`PUBLIC_SHARE`, `UTILISATION_CEILING`, growth rate `g`), so they are computed **in the browser**, not in SQL.

This is the boundary rule from the pipeline flow, and EVIP is where it bites hardest — it has more sliders than ERIP. If you bake demand into the parquet, `PUBLIC_SHARE` becomes a decorative control, and `PUBLIC_SHARE` is the most important parameter in the project.

---

## 11. Validation

```python
import pandera as pa

CITY_SCHEMA = pa.DataFrameSchema(
    {
        "city":          pa.Column(str,   nullable=False, unique=True),
        "state":         pa.Column(str,   nullable=False),
        "lat":           pa.Column(float, pa.Check.in_range(6.5, 37.1)),   # India bbox
        "lon":           pa.Column(float, pa.Check.in_range(68.1, 97.4)),
        "population":    pa.Column(int,   pa.Check.gt(0)),
        "ev_2w":         pa.Column(int,   pa.Check.ge(0)),
        "ev_3w":         pa.Column(int,   pa.Check.ge(0)),
        "ev_4w":         pa.Column(int,   pa.Check.ge(0)),
        "ev_bus":        pa.Column(int,   pa.Check.ge(0)),
        "n_stations":    pa.Column(int,   pa.Check.ge(0)),
        "n_connectors":  pa.Column(int,   pa.Check.ge(0)),
        "total_kw":      pa.Column(float, pa.Check.in_range(0, 100_000)),
        "registration_confidence": pa.Column(str, pa.Check.isin(["reported", "modelled"])),
    },
    strict=True,
    coerce=True,
)
```

Cross-field checks pandera won't infer:

```python
assert (df.n_connectors >= df.n_stations).all(),  "fewer connectors than stations"
assert (df.total_kw / df.n_connectors.clip(lower=1)).between(1, 400).all(), \
       "implausible per-connector rating — check the regex"
```

That second one is the important one. Per-connector power outside roughly 1–400 kW means the parse picked up a voltage, a serial number, or a price. It will catch a bad regex before it silently reshapes your entire ranking.

`QUALITY.md` should record: row count, cities unmatched then resolved, **connector parse rate**, state-total reconciliation (city registrations should sum back to the state figure), and the run timestamp.

---

## 12. Export to the frontend

```python
payload = {
    "meta": {
        "generated": pd.Timestamp.utcnow().isoformat(),
        "engine_version": ENGINE_VERSION,
        "rows": len(df),
        "connector_parse_rate": round(parse_rate, 3),
        "sources": json.loads(pathlib.Path("data/sources.json").read_text()),
    },
    "config": DEFAULTS,     # public_share per class, utilisation, connector kW, growth g
    "cities": df.to_dict(orient="records"),
}
pathlib.Path("web/public/data/cities.json").write_text(
    json.dumps(payload, separators=(",", ":"))
)
```

**Ships raw:** `ev_2w/3w/4w/bus`, `total_kw`, `n_connectors`, `population`.
**Computed in browser:** demand, supply, deficit, growth projection, crossover year, allocation.

Surfacing `connector_parse_rate` in `meta` and rendering it in the methodology page is a small thing that reads as unusually careful.

~150 cities should land near 60 KB. Above 500 KB, something is wrong.

---

## 13. Scheduled refresh

```yaml
# .github/workflows/refresh-evip.yml
name: refresh-evip
on:
  schedule:
    - cron: "0 4 * * 1"        # weekly, Mondays — charging infra actually moves
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync
      - env:
          DATA_GOV_API_KEY: ${{ secrets.DATA_GOV_API_KEY }}
        working-directory: apps/evip
        run: |
          uv run python analysis/ingest.py
          uv run python analysis/prepare.py
          uv run python analysis/export.py
      - name: Commit if changed
        run: |
          git config user.name  "data-bot"
          git config user.email "data-bot@users.noreply.github.com"
          git add apps/evip/web/public/data/cities.json apps/evip/data/processed/QUALITY.md
          git diff --staged --quiet || git commit -m "data: refresh EVIP $(date -u +%F)"
          git push
```

Weekly against ERIP's monthly, because the underlying data moves faster. Vercel redeploys on push.

Add a failure notification — a silently broken refresh that leaves stale data on a live portfolio site is worse than no refresh at all. The simplest version is letting the Action fail loudly; GitHub emails you.

---

## 14. Failure modes and timeboxes

| Minute | If you are here | Do this |
|---|---|---|
| 0–15 | MoP dataset via data.gov.in API | If the API resists, download the CSV manually from the portal |
| 15–25 | EV registrations | If class breakdown is missing, use total EVs with one blended `PUBLIC_SHARE`; note it |
| 25–40 | City matching | Population floor first, then alias tail |
| 40–55 | Connector parsing | Below 80% parse rate → `n_stations × DEFAULT_STATION_KW`, document it |
| 55 | OSM cross-check | Cut it if behind. It's the optional one. |
| 60 | Anything incomplete | Cut to the top 60 cities by registrations and move on |

If registrations won't join at all, fall back to population as the demand proxy — but **rename the metric honestly** in the UI and README. "Population-implied charging demand" is a defensible second-best; calling it EV demand when it isn't is not.

---

## 15. Commands

```bash
cd apps/evip
python analysis/ingest.py       # ① network → data/raw/   (cached, resumable)
python analysis/prepare.py      # ② conform + validate → processed/ + QUALITY.md
duckdb < analysis/sql/build.sql # ③ derived columns → analysis.parquet
python analysis/export.py       # ④ → web/public/data/cities.json
cd web && pnpm dev              # ⑤⑥
```

`rm -rf data/processed && python analysis/prepare.py` must reproduce everything from `raw/` with no network. If it doesn't, the ingest/transform boundary has leaked.
