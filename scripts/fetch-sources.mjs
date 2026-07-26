/**
 * Stage ①: network → `data/raw/`. Fetches only; never transforms, never derives.
 * `scripts/build-cities.mjs` is stage ② and reads only what this writes, so a
 * rebuild works with the network unplugged.
 *
 *   node scripts/fetch-sources.mjs           # cached — skips files already present
 *   node scripts/fetch-sources.mjs --force   # re-fetch everything
 *
 * data.gov.in needs an API key. Set DATA_GOV_API_KEY for your own; the fallback
 * is the portal's documented public sample key, which works but is capped at 10
 * records per request (hence the pagination below) and is rate-limited.
 */
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAW = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "raw");
const FORCE = process.argv.includes("--force");
const API_KEY =
  process.env.DATA_GOV_API_KEY ??
  "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";

/**
 * The data.gov.in resources that survived verification. Every other charging
 * dataset on the portal turned out to be a parliamentary answer table at state
 * resolution or coarser, with no city breakdown to build on.
 */
const RESOURCES = {
  mop_charging_stations: {
    rid: "34609614-1e3f-4fc6-b5c5-e05f1c8ec362",
    title: "State/UT-wise Number of EV Charging Stations Installed as on 01-03-2025",
    publisher: "Ministry of Power",
  },
  ev_registrations_state: {
    rid: "729dd0fe-a438-49eb-9766-9cdb0ea4b4e2",
    title: "State/UT-wise Total EVs Registered as % of Total Vehicles Sold",
    publisher: "Ministry of Road Transport & Highways (Vahan)",
  },
  ev_registrations_by_year: {
    rid: "acf1f1b0-265b-4693-b58b-4ffc62b8101c",
    title: "State/UT-wise Number of EVs Registered in Vahan4 from 2020 to 2023",
    publisher: "Ministry of Road Transport & Highways (Vahan)",
  },
  ev_registrations_by_class: {
    rid: "4596d19c-fdfc-4bec-99d2-99e64f9ae3b1",
    title: "State/UT-wise Number of EVs Registered by Vehicle Class (e-Vahan)",
    publisher: "Ministry of Road Transport & Highways (Vahan)",
  },
};

/** India bbox, matching INDIA_BBOX in lib/constants.ts. */
const OVERPASS_QUERY = `[out:json][timeout:180];
nwr["amenity"="charging_station"](6.5,68.1,37.1,97.4);
out tags center;`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Overpass returns 504 under load and 429 when the caller has burned its
 * execution slots, often enough that one attempt is not a pipeline — it is a
 * coin flip. A 429 is a slot exhaustion that clears in minutes, not seconds, so
 * it waits far longer than an ordinary error; anything else backs off 2s/8s.
 */
async function retrying(label, attempt) {
  let lastError;
  for (let i = 1; i <= 3; i++) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      if (i < 3) {
        const throttled = error.message.includes("429");
        const wait = throttled ? 90_000 * i : 2000 * i * i;
        console.warn(
          `  ${label}: attempt ${i} failed (${error.message}) — retrying in ${wait / 1000}s`
        );
        await sleep(wait);
      }
    }
  }
  throw new Error(`${label} failed after 3 attempts: ${lastError.message}`);
}

/** Pages through a data.gov.in resource 10 rows at a time until `total` is in. */
async function fetchResource(key, { rid }) {
  const records = [];
  let total = Infinity;
  let meta = {};

  while (records.length < total) {
    const url =
      `https://api.data.gov.in/resource/${rid}` +
      `?api-key=${API_KEY}&format=json&limit=10&offset=${records.length}`;

    const page = await retrying(`${key} @${records.length}`, async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });

    total = Number(page.total);
    meta = { title: page.title, updated_date: page.updated_date, field: page.field };

    if (page.records.length === 0) break; // defensive: never spin on an empty page
    records.push(...page.records);
  }

  return { ...meta, rid, total, records };
}

/**
 * GET, not POST: the main endpoint answers POST with a 406 regardless of
 * content-type, while the identical query as a GET param is accepted. Mirrors
 * are tried in order because any one of them may be loaded or throttled.
 */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function fetchOverpass() {
  for (const [i, endpoint] of OVERPASS_ENDPOINTS.entries()) {
    const last = i === OVERPASS_ENDPOINTS.length - 1;
    try {
      return await retrying(`overpass ${new URL(endpoint).host}`, async () => {
        const url = `${endpoint}?${new URLSearchParams({ data: OVERPASS_QUERY })}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(240_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      });
    } catch (error) {
      if (last) throw error;
      console.warn(`  falling back to ${new URL(OVERPASS_ENDPOINTS[i + 1]).host}`);
    }
  }
}

function write(name, payload, source) {
  const path = join(RAW, `${name}.json`);
  writeFileSync(
    path,
    JSON.stringify({ _fetched: new Date().toISOString(), _source: source, ...payload }, null, 2) +
      "\n"
  );
  return path;
}

/** True if the file is already on disk and --force was not passed. */
function cached(name) {
  return !FORCE && existsSync(join(RAW, `${name}.json`));
}

mkdirSync(RAW, { recursive: true });

for (const [name, resource] of Object.entries(RESOURCES)) {
  if (cached(name)) {
    console.log(`${name}: cached`);
    continue;
  }
  const payload = await fetchResource(name, resource);
  write(name, payload, `https://api.data.gov.in/resource/${resource.rid}`);
  console.log(`${name}: ${payload.records.length}/${payload.total} rows`);
}

if (cached("osm_charging_stations")) {
  console.log("osm_charging_stations: cached");
} else {
  const osm = await fetchOverpass();
  write("osm_charging_stations", osm, "https://overpass-api.de/api/interpreter");
  console.log(`osm_charging_stations: ${osm.elements.length} stations`);
}
