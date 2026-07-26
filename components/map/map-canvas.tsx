"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useTheme } from "next-themes";
import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import { useStateFeatures } from "@/hooks/use-state-features";
import { stateAggregate } from "@/lib/aggregate";
import {
  INDIA_BOUNDS,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URLS,
} from "@/lib/constants";
import { markerRadius, quantileScale } from "@/lib/color-scale";
import { displayMetric, METRICS } from "@/lib/metrics";
import type { MapCanvasProps } from "./types";

/**
 * The only file that touches Leaflet. Default `Marker` icons are never used —
 * bundlers rewrite their asset paths and the icons silently disappear — so every
 * point is a `CircleMarker`.
 */
export default function MapCanvas({
  cities,
  colorBy,
  sizeBy = "registered_ev",
  selectedId,
  onSelect,
  fitToCities = false,
  states,
}: MapCanvasProps) {
  const { resolvedTheme } = useTheme();
  const metric = METRICS[colorBy];
  const sizeMetric = METRICS[sizeBy];

  const scale = useMemo(
    () => quantileScale(cities.map(metric.value), metric.higherIsWorse),
    [cities, metric]
  );

  const sizeMax = useMemo(
    () => Math.max(...cities.map(sizeMetric.value), 0),
    [cities, sizeMetric]
  );

  const visibleStates = useMemo(
    () => states ?? [...new Set(cities.map((c) => c.state))],
    [states, cities]
  );
  const features = useStateFeatures(visibleStates);

  const boundaryColor = (name: string) => {
    const aggregate = stateAggregate(name);
    return aggregate ? scale.color(metric.stateValue(aggregate)) : undefined;
  };

  return (
    <MapContainer
      bounds={INDIA_BOUNDS}
      boundsOptions={{ padding: [6, 6] }}
      minZoom={MAP_MIN_ZOOM}
      maxZoom={MAP_MAX_ZOOM}
      zoomSnap={0.25}
      // Page scroll wins over map zoom; the +/- controls stay available.
      scrollWheelZoom={false}
      className="size-full"
      // The comparison table is the keyboard-accessible view of the same data.
      aria-label="Map of Indian cities coloured by charging infrastructure need"
    >
      <TileLayer
        url={resolvedTheme === "dark" ? TILE_URLS.dark : TILE_URLS.light}
        attribution={TILE_ATTRIBUTION}
        // Markers and boundaries stay visible if tiles never arrive.
        errorTileUrl=""
      />

      {features.map((feature) => {
        const name = feature.properties.st_nm;
        const fill = boundaryColor(name);
        return (
          <GeoJSON
            key={`${name}-${colorBy}-${resolvedTheme}`}
            data={feature}
            interactive={false}
            style={{
              color: fill ?? "currentColor",
              weight: 0.75,
              opacity: fill ? 0.5 : 0.25,
              fillColor: fill,
              fillOpacity: fill ? 0.1 : 0,
            }}
          />
        );
      })}

      {cities.map((city) => {
        const selected = city.id === selectedId;
        return (
          <CircleMarker
            key={city.id}
            center={[city.lat, city.lng]}
            radius={markerRadius(sizeMetric.value(city), sizeMax)}
            pathOptions={{
              color: selected ? "#0f172a" : scale.color(metric.value(city)),
              weight: selected ? 2.5 : 1,
              opacity: selected ? 1 : 0.9,
              fillColor: scale.color(metric.value(city)),
              fillOpacity: selected ? 0.95 : 0.7,
            }}
            eventHandlers={onSelect ? { click: () => onSelect(city) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={1}>
              <span className="font-medium">{city.city}</span>
              <span className="text-muted-foreground"> · {city.state}</span>
              <br />
              {metric.short}: <strong>{displayMetric(metric, city)}</strong>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {fitToCities ? <FitToCities cities={cities} /> : null}
    </MapContainer>
  );
}

/** Keeps the viewport on whatever the filters left behind. */
function FitToCities({ cities }: { cities: MapCanvasProps["cities"] }) {
  const map = useMap();

  useEffect(() => {
    if (cities.length === 0) return;
    const bounds = L.latLngBounds(cities.map((c) => [c.lat, c.lng]));
    map.flyToBounds(bounds.pad(0.12), { duration: 0.4, maxZoom: 7 });
  }, [cities, map]);

  return null;
}
