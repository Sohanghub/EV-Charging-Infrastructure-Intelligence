"use client";

import { Clock, Gauge, MapPin, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { KPICard } from "@/components/kpi-card";
import { SectionHeading } from "@/components/section-heading";
import { allocateStations, summarizeImpact } from "@/lib/allocation";
import {
  CHARGING_POINTS_PER_STATION,
  FAST_POINTS_PER_STATION,
  SLIDER_DEFAULT_STATIONS,
} from "@/lib/constants";
import { formatCompact, formatNumber, formatPercent } from "@/lib/format";
import type { ScoredCity } from "@/lib/types";
import { AllocationChart, GapAnalysisChart } from "./allocation-chart";
import { InvestmentSlider } from "./investment-slider";
import { PriorityTable } from "./priority-table";
import { RecommendationCards } from "./recommendation-cards";

export function RecommendationsView({ cities }: { cities: ScoredCity[] }) {
  const [stations, setStations] = useState(SLIDER_DEFAULT_STATIONS);

  // Everything on the page derives from these two. No hand-tuned values.
  const allocations = useMemo(() => allocateStations(cities, stations), [cities, stations]);
  const impact = useMemo(() => summarizeImpact(allocations), [allocations]);

  const points = stations * CHARGING_POINTS_PER_STATION;

  return (
    <div className="space-y-10">
      <SectionHeading
        as="h1"
        eyebrow="Recommendations"
        title={`If funding allowed ${formatNumber(stations)} new charging stations, where should they be installed?`}
        description={`Each station is a ${CHARGING_POINTS_PER_STATION}-point site: ${FAST_POINTS_PER_STATION} DC fast and ${CHARGING_POINTS_PER_STATION - FAST_POINTS_PER_STATION} AC. Stations are split across the ${impact.cities} highest-priority cities by the largest-remainder rule, so every city gets a whole number and the total always matches the slider.`}
      />

      <InvestmentSlider stations={stations} onChange={setStations} />

      {/* Computed from the allocation, never hardcoded. */}
      <p className="text-pretty text-lg leading-relaxed sm:text-xl">
        Deploying{" "}
        <strong className="font-semibold">{formatNumber(stations)} stations</strong> (
        {formatNumber(points)} charging points) across these {impact.cities} cities closes{" "}
        <strong className="font-semibold text-chart-2">
          {formatPercent(impact.deficit_closure)}
        </strong>{" "}
        of their energy shortfall, weighted by allocation, delivering{" "}
        <strong className="font-semibold text-chart-2">
          {formatCompact(impact.added_kwh_day)} kWh a day
        </strong>
        .
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          label="Stations funded"
          value={formatNumber(impact.stations)}
          hint={`${formatNumber(impact.charging_points)} charging points`}
          icon={Zap}
          tone="infrastructure"
        />
        <KPICard
          label="Cities funded"
          value={formatNumber(impact.cities)}
          hint="Top priority cities, one station minimum"
          icon={MapPin}
        />
        <KPICard
          label="Deficit closed"
          value={formatPercent(impact.deficit_closure)}
          hint={`${formatCompact(impact.deficit_closed_kwh)} kWh/day of shortfall removed`}
          icon={Gauge}
          tone="infrastructure"
        />
        <KPICard
          label="Energy added"
          value={`${formatCompact(impact.added_kwh_day)} kWh`}
          hint="Deliverable per day at the assumed utilisation"
          icon={Clock}
          tone="demand"
        />
      </div>

      <section className="space-y-4">
        <SectionHeading
          as="h2"
          title="The case for each city"
          description="Ranked by priority score. Every figure below is recomputed as the slider moves."
        />
        <RecommendationCards allocations={allocations} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AllocationChart allocations={allocations} stations={stations} />
        <GapAnalysisChart allocations={allocations} stations={stations} />
      </section>

      <section className="space-y-4">
        <SectionHeading
          as="h2"
          title="Full allocation"
          description="The complete ranking with the modelled effect on each city's energy deficit, and how long until demand overtakes supply."
        />
        <PriorityTable allocations={allocations} />
      </section>
    </div>
  );
}
