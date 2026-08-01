import { AlertTriangle, ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { SectionHeading } from "@/components/section-heading";
import methodology from "@/data/methodology.json";
import sensitivity from "@/data/sensitivity.json";
import { national } from "@/lib/aggregate";
import {
  CAPACITY_UTILISATION,
  CHARGERS_PER_1000_BENCHMARK,
  CHARGING_POINTS_PER_STATION,
  EV_PER_CHARGER_BENCHMARK,
  HOURS_PER_DAY,
  MAX_GROWTH_RATE,
  PROJECTION_YEARS,
  RECOMMENDATION_POOL_SIZE,
  SEVERITY_THRESHOLDS,
  SLIDER_MAX_STATIONS,
  SLIDER_MIN_STATIONS,
  STATION_AC_KW,
  STATION_DC_KW,
} from "@/lib/constants";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Methodology } from "@/lib/types";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "The benchmarks, scoring weights, allocation algorithm, impact assumptions and limitations behind every number in EVIP.",
};

const { data_sources, definitions, scoring_weights, assumptions, limitations } =
  methodology as Methodology;

/** The scoring pipeline, written the way it is implemented in lib/scoring.ts. */
const FORMULAS = [
  {
    name: "Demand",
    formula: "Σ class fleet × daily kWh × public share",
    note: "kWh/day of public charging energy the city's fleet wants. Four classes, each with its own duty cycle and public share. A three-wheeler draws about 42× the public energy of a two-wheeler, which is why the unit is energy and not vehicles.",
  },
  {
    name: "Supply",
    formula: `total_kw × ${HOURS_PER_DAY} × ${CAPACITY_UTILISATION}`,
    note: `kWh/day the installed capacity can actually deliver. Capacity is built from two rates, ${STATION_DC_KW} kW per DC point and ${STATION_AC_KW} kW per AC point, never from a point count.`,
  },
  {
    name: "Energy deficit",
    formula: "demand_kwh_day − supply_kwh_day",
    note: "Positive is unmet demand, negative is spare capacity.",
  },
  {
    name: "Deficit ratio",
    formula: "demand_kwh_day / supply_kwh_day",
    note: `The severity band. ${SEVERITY_THRESHOLDS.moderate}.0 is break-even, ${SEVERITY_THRESHOLDS.critical}.0 is demand at double capacity.`,
  },
  {
    name: "Priority score",
    formula: "max(0, demand_kwh_day − supply_kwh_day)",
    note: "The unmet energy itself, with no multipliers. It already scales with fleet size and already reflects how badly served a city is. A city in surplus scores zero rather than negative — spare capacity is no claim on the next station.",
  },
  {
    name: "Projected demand",
    formula: "demand_kwh_day × (1 + ev_growth_rate) ^ years",
    note: `Growth appears here and nowhere else. The crossover year is the first year projected demand overtakes supply, searched to ${PROJECTION_YEARS} years; a city whose registrations are falling never crosses and is labelled as such.`,
  },
  {
    name: "Chargers per 1,000 EVs",
    formula: "public_chargers / (registered_ev / 1000)",
    note: `Context only — it ranks nothing. The old ${CHARGERS_PER_1000_BENCHMARK}-per-1,000 benchmark (one point per ${EV_PER_CHARGER_BENCHMARK} EVs) is retired: it counts an e-2W and an e-bus as one unit of demand each, and on real data it called 94 of 100 cities adequately served.`,
  },
  {
    name: "Growth score",
    formula: `clamp(ev_growth_rate / ${MAX_GROWTH_RATE}, 0, 1)`,
    note: "An Explore metric only. It is not an input to the priority score.",
  },
];

const ALLOCATION_STEPS = [
  `Rank every city by priority score, breaking ties by demand and then by name, and take the top ${RECOMMENDATION_POOL_SIZE}.`,
  "Give each of those cities one station, so no funded city receives nothing.",
  "Share the remaining stations in proportion to each city's priority score.",
  "Floor every share to a whole station.",
  "Hand the leftover stations, one at a time, to the largest fractional remainders.",
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-14 px-4 py-10 sm:px-6">
      <SectionHeading
        as="h1"
        eyebrow="Methodology"
        title="How every number on this site is produced"
        description="Definitions first, then the scoring pipeline, the allocation rule, the impact model, and what the model cannot tell you."
      />

      <aside className="flex gap-3 rounded-lg border border-chart-3/30 bg-chart-3/5 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-chart-3" aria-hidden />
        <div className="space-y-1 text-sm">
          <p className="font-medium">
            Every city figure here is modelled from published state totals, not reported.
          </p>
          <p className="text-muted-foreground">
            India does not publish charging-station or EV-registration data at city level,
            so no figure on this site is <em>reported</em> at the resolution it is shown.
            Charger and registration levels are real Ministry of Power and Vahan state
            totals split across cities — <em>modelled</em> — using OpenStreetMap station
            counts where a state has enough mapped stations and population where it does
            not. Telangana reports through neither table, so its five cities carry an{" "}
            <em>imputed</em> state total and are tagged as such. Nothing is generated from
            a seed; deleting the dataset and re-running the build reproduces it exactly.
            The model covers {formatNumber(national.cities)} cities in {national.states}{" "}
            states, and nothing on this site should be used to make an actual investment
            decision.
          </p>
        </div>
      </aside>

      <Section title="Definitions" description="These are load-bearing — the arithmetic depends on them.">
        <dl className="space-y-4">
          {definitions.map(({ term, definition }) => (
            <div key={term}>
              <dt className="text-sm font-medium">{term}</dt>
              <dd className="mt-0.5 text-sm text-pretty text-muted-foreground">
                {definition}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          Severity bands are fixed ratios of demand to deliverable supply, not
          percentiles: supply covers demand below {SEVERITY_THRESHOLDS.moderate}
          &times;, demand exceeds supply from {SEVERITY_THRESHOLDS.moderate}&times;, and
          it is critical at {SEVERITY_THRESHOLDS.critical}&times; or more. Fixed cut
          points mean the public-share assumptions move cities between bands, which is
          the point — percentiles would hold the band sizes constant and hide the
          sensitivity.
        </p>
      </Section>

      <Section
        title="Derived metrics"
        description="Pure functions over one city record. Full precision is kept internally; rounding happens only at display."
      >
        <ul className="space-y-4">
          {FORMULAS.map(({ name, formula, note }) => (
            <li key={name}>
              <p className="text-sm font-medium">{name}</p>
              <code className="mt-1 block overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
                {formula}
              </code>
              <p className="mt-1 text-sm text-muted-foreground">{note}</p>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-pretty text-muted-foreground">
          There are no multipliers. An earlier version multiplied a points-per-EV base by
          queue, density and population factors, all of which existed to compensate for a
          base with no physical meaning. A daily energy shortfall needs no such
          correction, and the queue and utilization figures those multipliers read are not
          published by any source — they have been removed from the dataset entirely.
        </p>
      </Section>

      <Section
        title="Why each term is weighted the way it is"
        description="The weights are judgement calls. Here is the reasoning behind each."
      >
        <dl className="space-y-4">
          {scoring_weights.map(({ term, rationale }) => (
            <div key={term}>
              <dt className="text-sm font-medium">{term}</dt>
              <dd className="mt-0.5 text-sm text-pretty text-muted-foreground">
                {rationale}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title="Allocation rule"
        description={`Largest-remainder method. Stations are whole numbers and the allocation always sums to exactly the funded total, anywhere between ${SLIDER_MIN_STATIONS} and ${SLIDER_MAX_STATIONS} stations.`}
      >
        <ol className="space-y-2 text-sm">
          {ALLOCATION_STEPS.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                {index + 1}
              </span>
              <span className="text-pretty text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          One station is always {CHARGING_POINTS_PER_STATION} charging points, so all
          impact arithmetic converts stations to points before doing anything else.
        </p>
      </Section>

      <Section
        title="Impact assumptions"
        description="What the before-and-after numbers on the Recommendations page actually assume."
      >
        <ul className="space-y-3 text-sm">
          {assumptions.map((assumption) => (
            <li key={assumption} className="flex gap-3">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
              <span className="text-pretty text-muted-foreground">{assumption}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Does the sign hold?"
        description="Demand scales with fleet times public share, so break-even is a single product, not two thresholds. This grid moves both."
      >
        <p className="text-sm text-pretty text-muted-foreground">
          National deficit in million kWh/day at each combination of electric
          three-wheeler fleet size and public-charging share. Positive is a deficit,
          negative a surplus. Break-even sits at a fleet-times-share product of{" "}
          {formatNumber(sensitivity.breakeven_product)}.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th className="py-2 pr-3 font-medium">e-3W fleet</th>
                {sensitivity.shares.map((share) => (
                  <th key={share} className="py-2 pl-3 text-right font-medium">
                    {formatPercent(share)} public
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensitivity.fleets.map((fleet, row) => (
                <tr key={fleet} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                    {formatNumber(fleet)}
                    {fleet === sensitivity.floor_3w && (
                      <span className="text-muted-foreground"> (Dec-2022 floor)</span>
                    )}
                    {row === sensitivity.fleets.length - 1 && (
                      <span className="text-muted-foreground"> (central)</span>
                    )}
                  </td>
                  {sensitivity.grid[row].map((value, column) => (
                    <td
                      key={sensitivity.shares[column]}
                      className={`py-2 pl-3 text-right tabular-nums ${
                        value > 0 ? "font-medium text-chart-3" : "text-muted-foreground"
                      }`}
                    >
                      {value > 0 ? "+" : "−"}
                      {Math.abs(value / 1e6).toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-pretty text-muted-foreground">
          The deficit holds across the plausible range. It reverses only if the fleet sat
          at its December 2022 floor <strong>and</strong> the public share is roughly half
          the assumed value at the same time — at the floor, break-even share is{" "}
          {formatPercent(sensitivity.breakeven_share_by_fleet[0])}, not{" "}
          {formatPercent(sensitivity.breakeven_share_by_fleet.at(-1)!)}. That corner is
          unlikely but live, and the floor-fleet cell at the default share is marginal
          either way. Duty cycle is a third axis of the same shape — break-even is really
          fleet × share × kWh/day — but 90 km/day is argued as a floor rather than a
          central estimate, so moving it can only push toward deficit, never away.
          Generated by <code className="font-mono text-xs">npm run data</code>{" "}
          from the shipping city model, aggregated and divided by the urban share to read
          nationally.
        </p>
      </Section>

      <Section title="Limitations" description="What this model cannot tell you.">
        <ul className="space-y-3 text-sm">
          {limitations.map((limitation) => (
            <li key={limitation} className="flex gap-3">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-chart-3" aria-hidden />
              <span className="text-pretty text-muted-foreground">{limitation}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Reference sources"
        description="Every level in the dataset comes from these. Nothing is invented; the model only splits their state totals across cities."
      >
        <ul className="space-y-4">
          {data_sources.map(({ name, url, note }) => (
            <li key={name}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium underline-offset-4 hover:underline"
              >
                {name}
                <ExternalLink className="size-3 text-muted-foreground" aria-hidden />
              </a>
              <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{note}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <SectionHeading as="h2" title={title} description={description} />
      {children}
    </section>
  );
}
