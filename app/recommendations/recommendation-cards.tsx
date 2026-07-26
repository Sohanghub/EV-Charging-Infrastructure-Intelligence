"use client";

import { Clock, MapPin, TrendingUp, Zap } from "lucide-react";

import { StaggerItem } from "@/components/page-transition";
import { SeverityBadge } from "@/components/severity-badge";
import { DAILY_KWH, PUBLIC_SHARE_DEFAULTS } from "@/lib/constants";
import { crossoverLabel } from "@/lib/scoring";
import {
  formatCompact,
  formatDecimal,
  formatNumber,
  formatPercent,
  formatPopulation,
} from "@/lib/format";
import type { Allocation, ScoredCity } from "@/lib/types";

const CARD_COUNT = 6;

/**
 * The case for each city, assembled from its own numbers — strongest driver
 * first. Nothing here is written by hand.
 */
function drivers(city: ScoredCity): string[] {
  const demand = city.demand_kwh_day || 1;
  const reasons: { weight: number; text: string }[] = [
    {
      weight: (city.ev_3w * DAILY_KWH.ev_3w * PUBLIC_SHARE_DEFAULTS.ev_3w) / demand,
      text: `${formatCompact(city.ev_3w)} three-wheelers drawing ${formatPercent(
        (city.ev_3w * DAILY_KWH.ev_3w * PUBLIC_SHARE_DEFAULTS.ev_3w) / demand
      )} of its public charging energy`,
    },
    {
      weight: Math.min(1, city.deficit_ratio / 4),
      text: `demand at ${formatDecimal(city.deficit_ratio, 2)}x deliverable supply`,
    },
    {
      weight: city.total_kw > 0 ? Math.min(1, 20 / (city.total_kw / 1000)) : 1,
      text: `only ${formatNumber(city.total_kw)} kW installed`,
    },
    {
      weight: city.growth_score,
      text: `a fleet growing ${formatPercent(city.ev_growth_rate)} a year`,
    },
  ];

  return reasons
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((r) => r.text);
}

export function RecommendationCards({ allocations }: { allocations: Allocation[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {allocations.slice(0, CARD_COUNT).map((allocation, index) => (
        <StaggerItem key={allocation.city.id} index={index}>
          <RecommendationCard allocation={allocation} rank={index + 1} />
        </StaggerItem>
      ))}
    </ul>
  );
}

function RecommendationCard({
  allocation: a,
  rank,
}: {
  allocation: Allocation;
  rank: number;
}) {
  const [first, second] = drivers(a.city);

  return (
    <li className="flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground tabular-nums">
            Rank {rank}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold tracking-tight">{a.city.city}</h3>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" aria-hidden />
            {a.city.state} · {formatPopulation(a.city.population_lakhs)}
          </p>
        </div>
        <SeverityBadge severity={a.city.severity} />
      </div>

      <p className="mt-4 text-sm text-pretty text-muted-foreground">
        Short {formatCompact(a.city.deficit_kwh_day)} kWh a day, driven by {first} and{" "}
        {second}.
        {a.city.crossover_year === null && a.city.ev_growth_rate <= 0
          ? " Its fleet is shrinking, so the shortfall is not growing."
          : ""}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <Figure
          icon={Zap}
          label="Allocation"
          value={`${formatNumber(a.stations)} stations`}
          note={`${formatNumber(a.charging_points)} points · ${formatNumber(a.fast_points)} DC fast`}
        />
        <Figure
          icon={TrendingUp}
          label="Deficit closed"
          value={formatPercent(a.deficit_closure)}
          note={`${formatCompact(a.deficit_after)} kWh/day still short`}
        />
        <Figure
          icon={Clock}
          label="Energy added"
          value={`${formatCompact(a.added_kwh_day)} kWh/day`}
          note={`${formatNumber(a.added_kw)} kW installed`}
        />
        <Figure
          icon={MapPin}
          label="Crossover"
          value={crossoverLabel(a.city)}
          note={`${formatNumber(a.city.registered_ev)} registered EVs`}
        />
      </dl>
    </li>
  );
}

function Figure({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3" aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
      <dd className="text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}
