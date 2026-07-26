import { ArrowRight, BatteryCharging, Gauge, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";

import { KPICard } from "@/components/kpi-card";
import { buttonVariants } from "@/components/ui/button";
import { national } from "@/lib/aggregate";
import { CHARGERS_PER_1000_BENCHMARK, EV_PER_CHARGER_BENCHMARK } from "@/lib/constants";
import { formatCompact, formatDecimal, formatNumber, formatPercent } from "@/lib/format";

export function HeroSection() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          EV Charging Infrastructure Intelligence
        </p>

        <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Where will India need its next charging station?
        </h1>

        <p className="mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          EV registrations are outrunning public charging in most Indian cities. This
          platform ranks {formatNumber(national.cities)} cities by how much unmet charging
          demand each existing point already carries, then allocates a fixed investment to
          the places where new stations would relieve the most pressure.
        </p>

        {/* The headline figure is computed from the dataset, never written down. */}
        <p className="mt-6 max-w-2xl text-pretty text-lg font-medium sm:text-xl">
          <span className="text-chart-4">
            {national.cities_in_deficit} of {national.cities} cities
          </span>{" "}
          demand more public charging energy than their installed capacity can
          deliver — and{" "}
          {formatPercent(national.three_wheeler_demand_share)} of that demand is
          three-wheelers.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
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

        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          <KPICard
            label="Coverage"
            value={formatDecimal(national.chargers_per_1000_ev)}
            unit="per 1,000 EVs"
            hint={`Benchmark is ${CHARGERS_PER_1000_BENCHMARK}`}
            icon={Gauge}
            tone={
              national.chargers_per_1000_ev >= CHARGERS_PER_1000_BENCHMARK
                ? "infrastructure"
                : "warning"
            }
          />
          <KPICard
            label="Energy deficit"
            value={formatCompact(national.deficit_kwh_day)}
            unit="kWh/day"
            hint={`demand is ${formatDecimal(national.deficit_ratio, 2)}x deliverable supply`}
            icon={Zap}
            tone="critical"
          />
        </div>
      </div>
    </section>
  );
}
