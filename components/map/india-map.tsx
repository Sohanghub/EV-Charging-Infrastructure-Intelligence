"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { quantileScale } from "@/lib/color-scale";
import { METRICS } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { MapLegend } from "./map-legend";
import type { IndiaMapProps } from "./types";

/**
 * The one map component. Home and Explore both use it; a `colorBy` prop and an
 * `onSelect` callback are the only differences between them.
 *
 * Leaflet reaches for `window` at import time, so the canvas is the only part
 * loaded client-side. Everything around it renders on the server.
 */
const MapCanvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => <div className="size-full bg-muted" />,
});

export function IndiaMap({
  height = "h-[420px] md:h-[560px]",
  legend = true,
  className,
  ...canvas
}: IndiaMapProps) {
  const metric = METRICS[canvas.colorBy];
  const scale = useMemo(
    () => quantileScale(canvas.cities.map(metric.value), metric.higherIsWorse),
    [canvas.cities, metric]
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className={cn("overflow-hidden rounded-lg border border-border", height)}>
        <MapCanvas {...canvas} />
      </div>
      {legend ? <MapLegend metric={metric} scale={scale} /> : null}
    </div>
  );
}
