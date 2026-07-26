import type { ColorScale } from "@/lib/color-scale";
import type { MetricDef } from "@/lib/metrics";

/**
 * Discrete legend for the map's quantile scale. Rendered as ordinary DOM
 * outside the Leaflet container so it is selectable and readable by assistive
 * technology.
 */
export function MapLegend({ metric, scale }: { metric: MetricDef; scale: ColorScale }) {
  if (scale.buckets.length === 0) return null;

  const first = scale.buckets[0];
  const last = scale.buckets[scale.buckets.length - 1];
  const [low, high] = metric.higherIsWorse
    ? ["Adequate", "Needs investment"]
    : ["Needs investment", "Adequate"];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{metric.label}</span>
      <span className="flex items-center gap-1.5">
        <span>{low}</span>
        <span
          className="flex gap-px"
          role="img"
          aria-label={`Colour scale from ${low} to ${high}`}
        >
          {scale.buckets.map((bucket, i) => (
            <span
              key={i}
              className="h-3 w-6 rounded-[2px]"
              style={{ backgroundColor: bucket.color }}
              title={`${metric.format(bucket.min)} – ${metric.format(bucket.max)}`}
            />
          ))}
        </span>
        <span>{high}</span>
      </span>
      <span className="tabular-nums">
        {metric.format(first.min)} – {metric.format(last.max)}
      </span>
    </div>
  );
}
