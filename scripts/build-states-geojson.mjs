// One-shot: pull Natural Earth admin-1 boundaries, keep India, and write a
// simplified, bundle-sized `data/india-states.json`. Already run — the
// output is committed. Re-run only to refresh boundaries:
//   node scripts/build-states-geojson.mjs
// Source: Natural Earth (public domain), 1:10m admin-1 states/provinces.
import { writeFileSync } from "node:fs";

const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const PRECISION = 2; // ~1.1 km — plenty for a country-scale choropleth
const MIN_RING_POINTS = 4;

const round = (n) => Number(n.toFixed(PRECISION));

/** Round + drop consecutive duplicates; returns null if the ring collapsed. */
function thinRing(ring) {
  const out = [];
  for (const [lng, lat] of ring) {
    const p = [round(lng), round(lat)];
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) out.push(p);
  }
  if (out.length < MIN_RING_POINTS) return null;
  const [first, last] = [out[0], out[out.length - 1]];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([...first]);
  return out;
}

const thinPolygon = (poly) => poly.map(thinRing).filter(Boolean);

function thinGeometry(geometry) {
  if (geometry.type === "Polygon") {
    const rings = thinPolygon(geometry.coordinates);
    return rings.length ? { type: "Polygon", coordinates: rings } : null;
  }
  const polys = geometry.coordinates.map(thinPolygon).filter((p) => p.length);
  return polys.length ? { type: "MultiPolygon", coordinates: polys } : null;
}

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`${SOURCE} -> ${res.status}`);
const source = await res.json();

const features = source.features
  .filter((f) => f.properties.adm0_a3 === "IND")
  .map((f) => {
    const geometry = thinGeometry(f.geometry);
    return geometry && { type: "Feature", properties: { st_nm: f.properties.name }, geometry };
  })
  .filter(Boolean);

writeFileSync(
  new URL("../data/india-states.json", import.meta.url),
  JSON.stringify({ type: "FeatureCollection", features })
);
console.log(`${features.length} states -> data/india-states.json`);
