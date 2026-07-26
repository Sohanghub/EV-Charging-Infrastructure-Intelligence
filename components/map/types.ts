import type { MetricKey } from "@/lib/metrics";
import type { ScoredCity } from "@/lib/types";

export interface MapCanvasProps {
  cities: readonly ScoredCity[];
  /** Metric driving marker and boundary colour. */
  colorBy: MetricKey;
  /** Metric driving marker radius. Defaults to registered EVs. */
  sizeBy?: MetricKey;
  selectedId?: string | null;
  onSelect?: (city: ScoredCity) => void;
  /** Refit the viewport whenever the city list changes — used by Explore. */
  fitToCities?: boolean;
  /** Boundaries to draw. Defaults to the states present in `cities`. */
  states?: readonly string[];
}

export interface IndiaMapProps extends MapCanvasProps {
  /** Tailwind height classes. Map containers need an explicit height. */
  height?: string;
  /** Hide the colour legend when the surrounding UI already explains it. */
  legend?: boolean;
  className?: string;
}
