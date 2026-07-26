"use client";

import { useMemo, useState } from "react";

import { IndiaMap } from "@/components/map/india-map";
import { SectionHeading } from "@/components/section-heading";
import { PUBLIC_SHARE_DEFAULTS } from "@/lib/constants";
import { METRICS, type MetricKey } from "@/lib/metrics";
import { rankByPriority, scoreCity } from "@/lib/scoring";
import type { PublicShares, ScoredCity } from "@/lib/types";
import { CityDialog } from "./city-dialog";
import { ALL_STATES, FilterBar } from "./filter-bar";
import { ComparisonTable } from "./comparison-table";
import { InfrastructureCharts } from "./infrastructure-charts";
import { PublicShareSliders } from "./public-share-sliders";

/**
 * Owns the two filters the whole page reads from. Everything below derives from
 * `cities` in a `useMemo`, so the map, charts and table always agree.
 */
export function ExploreView({
  cities: allCities,
  states,
}: {
  cities: ScoredCity[];
  states: string[];
}) {
  const [state, setState] = useState<string>(ALL_STATES);
  const [metric, setMetric] = useState<MetricKey>("priority_score");
  const [selected, setSelected] = useState<ScoredCity | null>(null);
  const [shares, setShares] = useState<PublicShares>(PUBLIC_SHARE_DEFAULTS);

  // Rescoring on every slider move is what makes the sensitivity legible: the
  // severity bands are fixed, so cities cross between them as the shares change.
  const scored = useMemo(
    () => rankByPriority(allCities.map((c) => scoreCity(c, shares))),
    [allCities, shares]
  );

  const cities = useMemo(
    () => (state === ALL_STATES ? scored : scored.filter((c) => c.state === state)),
    [scored, state]
  );

  const banding = useMemo(() => {
    const counts = { critical: 0, moderate: 0, strong: 0 };
    for (const c of cities) counts[c.severity]++;
    return counts;
  }, [cities]);

  const visibleStates = useMemo(
    () => (state === ALL_STATES ? states : [state]),
    [state, states]
  );

  return (
    <div className="space-y-6">
      <FilterBar
        states={states}
        state={state}
        onStateChange={setState}
        metric={metric}
        onMetricChange={setMetric}
        matches={cities.length}
        total={allCities.length}
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <PublicShareSliders shares={shares} onChange={setShares} />
        <div className="flex items-center rounded-lg border border-border bg-card p-4 text-sm">
          <p className="text-pretty text-muted-foreground">
            At these assumptions{" "}
            <strong className="font-semibold text-foreground">
              {banding.critical + banding.moderate} of {cities.length}
            </strong>{" "}
            cities demand more public charging energy than they can deliver —{" "}
            <span className="text-chart-4">{banding.critical} critically</span>,{" "}
            {banding.moderate} marginally, {banding.strong} with capacity to spare.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <IndiaMap
          cities={cities}
          colorBy={metric}
          sizeBy="registered_ev"
          states={visibleStates}
          selectedId={selected?.id}
          onSelect={setSelected}
          fitToCities
          height="h-[420px] lg:h-[604px]"
        />
        <InfrastructureCharts cities={cities} metric={metric} onSelect={setSelected} />
      </div>

      <section className="space-y-4">
        <SectionHeading
          as="h3"
          title="Compare every city"
          description={`Sorted by ${METRICS[metric].label.toLowerCase()} on the map and charts; sort the table independently by any column.`}
        />
        <ComparisonTable
          cities={cities}
          onSelect={setSelected}
          selectedId={selected?.id}
        />
      </section>

      <CityDialog city={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
