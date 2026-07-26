"use client";

import type { FeatureCollection, Feature, Geometry } from "geojson";
import { useMemo } from "react";

// GeoJSON, stored with a .json extension so it needs no bundler loader.
// Cast once here: TypeScript would otherwise infer the whole 400 kB literal.
import boundaries from "@/data/india-states.json";

export type StateFeature = Feature<Geometry, { st_nm: string }>;

const key = (name: string) => name.trim().toLowerCase();

/** Built once, at module load, and shared by every page that draws the map. */
const FEATURES_BY_NAME = new Map<string, StateFeature>(
  (boundaries as unknown as FeatureCollection<Geometry, { st_nm: string }>).features.map(
    (f) => [key(f.properties.st_nm), f]
  )
);

/**
 * Boundary polygons for the given state names. States with no matching feature
 * are skipped silently — markers alone are an acceptable map.
 */
export function useStateFeatures(states: readonly string[]): StateFeature[] {
  return useMemo(
    () => states.map((s) => FEATURES_BY_NAME.get(key(s))).filter((f): f is StateFeature => !!f),
    [states]
  );
}
