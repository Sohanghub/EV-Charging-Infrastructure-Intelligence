import { ArrowRight, BatteryCharging, Gauge, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";

import { KPICard } from "@/components/kpi-card";
import { buttonVariants } from "@/components/ui/button";
import { national } from "@/lib/aggregate";
import { CHARGERS_PER_1000_BENCHMARK } from "@/lib/constants";
import { formatCompact, formatDecimal, formatNumber, formatPercent } from "@/lib/format";

export function HeroSection() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 pt-14 pb-12 sm:px-6 sm:pt-20 sm:pb-16">
        {/* Scope and sourcing, not the product name — the navbar already carries
            that verbatim, and the first question a sceptical reader has is where
            these numbers come from. */}
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {formatNumber(national.cities)} cities · Ministry of Power, Vahan &amp;
          OpenStreetMap
        </p>

        <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          Where will India need its next charging station?
        </h1>

        {/* The finding leads. It previously sat third, behind a generic "this
            platform does X" paragraph — the weakest sentence in the strongest
            slot on the page. Computed from the dataset, never written down. */}
        <p className="mt-6 max-w-2xl text-pretty text-lg font-medium sm:text-xl">
          <span className="text-chart-4">
            {national.cities_in_deficit} of {national.cities} cities
          </span>{" "}
          demand more public charging energy than their installed capacity can
          deliver — and{" "}
          {formatPercent(national.three_wheeler_demand_share)} of that demand is
          three-wheelers.
        </p>

        {/* Subordinate to the finding in both size and colour, so the two no
            longer compete. The ranking is unmet energy in kWh/day, not load per
            existing point — that was the per-vehicle model this replaced. */}
        <p className="mt-4 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
          Cities are ranked by the public charging energy their fleets demand but cannot
          get, then a fixed station budget is split across the places where new capacity
          relieves the most unmet demand.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {/* Navigation, not actions — these stay anchors and borrow the
              button styling rather than wrapping a link in a <button>. */}
          <Link href="/recommendations" className={buttonVariants({ size: "lg" })}>
            See where to build next
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/explore"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Explore the data
          </Link>
        </div>

        {/* Reads as a narrative left to right: how many EVs, how many points,
            what coverage says, what energy says. The last card is the one the
            headline turns on, so it is the only one carrying an accent. */}
        <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPICard
            label="Registered EVs"
            value={formatCompact(national.registered_ev)}
            hint={`Across ${national.states} states`}
            icon={TrendingUp}
            tone="demand"
          />
          <KPICard
            label="Public charging points"
            value={formatCompact(national.public_chargers)}
            hint={`${formatCompact(national.fast_chargers)} rated 50 kW or above`}
            icon={BatteryCharging}
            tone="infrastructure"
          />
          {/* Deliberately not toned green for clearing the benchmark. This is
              the metric the project exists to contradict — colouring it as good
              news argues the opposite of the sentence directly above it. */}
          <KPICard
            label="Coverage"
            value={formatDecimal(national.chargers_per_1000_ev)}
            unit="per 1,000 EVs"
            hint={`${formatDecimal(national.chargers_per_1000_ev / CHARGERS_PER_1000_BENCHMARK)}× the benchmark — on the wrong unit`}
            icon={Gauge}
          />
          <KPICard
            label="Energy deficit"
            value={formatCompact(national.deficit_kwh_day)}
            unit="kWh/day"
            hint={`demand is ${formatDecimal(national.deficit_ratio, 2)}x deliverable supply`}
            icon={Zap}
            tone="critical"
            className="border-chart-4/30"
          />
        </div>
      </div>
    </section>
  );
}
