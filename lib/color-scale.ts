/**
 * Discrete quantile colour scale. Five fixed steps rather than a gradient —
 * the bands stay readable at marker size and the legend can state its ranges.
 *
 * Quantiles, not min/max: priority scores and capacity gaps are long-tailed,
 * and a linear scale would collapse most cities into the first colour.
 */

/** Adequate -> critical. Index 0 is always the "no action needed" end. */
export const RAMP = ["#059669", "#65a30d", "#ca8a04", "#ea580c", "#dc2626"] as const;

export interface ColorBucket {
  min: number;
  max: number;
  color: string;
}

export interface ColorScale {
  color: (value: number) => string;
  /** Ascending by value. Empty when there is nothing to scale. */
  buckets: ColorBucket[];
}

const EMPTY: ColorScale = { color: () => RAMP[0], buckets: [] };

/** Value at fraction `q` of a sorted array, linearly interpolated. */
function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  return sorted[low] + (sorted[high] - sorted[low]) * (pos - low);
}

export function quantileScale(
  values: readonly number[],
  higherIsWorse: boolean
): ColorScale {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return EMPTY;

  const steps = RAMP.length;
  const edges = Array.from({ length: steps + 1 }, (_, i) => quantile(sorted, i / steps));

  const buckets: ColorBucket[] = Array.from({ length: steps }, (_, i) => ({
    min: edges[i],
    max: edges[i + 1],
    // Index 0 of the ramp is "fine". Flip it when a low value is the problem.
    color: RAMP[higherIsWorse ? i : steps - 1 - i],
  }));

  const color = (value: number) => {
    const i = buckets.findIndex((b, n) => value <= b.max || n === steps - 1);
    return buckets[Math.max(0, i)].color;
  };

  return { color, buckets };
}

/**
 * Marker radius in pixels, proportional to area so a city with four times the
 * value reads as twice the width rather than four times.
 */
export function markerRadius(value: number, max: number, min = 3.5, span = 11) {
  if (!(max > 0) || !Number.isFinite(value)) return min;
  return min + span * Math.sqrt(Math.max(0, value) / max);
}
