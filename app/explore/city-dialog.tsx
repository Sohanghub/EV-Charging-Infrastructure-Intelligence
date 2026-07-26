"use client";

import { SeverityBadge } from "@/components/severity-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CAPACITY_UTILISATION,
  DAILY_KWH,
  PUBLIC_SHARE_DEFAULTS,
  VEHICLE_CLASS_LABELS,
  VEHICLE_CLASSES,
} from "@/lib/constants";
import { crossoverLabel } from "@/lib/scoring";
import {
  formatCompact,
  formatDecimal,
  formatNumber,
  formatPercent,
  formatPopulation,
} from "@/lib/format";
import type { Confidence, ScoredCity } from "@/lib/types";

/** What each provenance tier means, spelled out where the numbers are read. */
const CONFIDENCE_NOTE: Record<Confidence, string> = {
  reported: "Published at city level and used unchanged.",
  modelled: "A published state total, split across the state's cities.",
  imputed: "The state total itself is estimated — this state is absent from Vahan.",
};

function ConfidenceBadge({ tier }: { tier: Confidence }) {
  return (
    <span
      title={CONFIDENCE_NOTE[tier]}
      className={
        "rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize " +
        (tier === "imputed"
          ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
          : "border-border text-muted-foreground")
      }
    >
      {tier}
    </span>
  );
}

/**
 * The full profile behind one marker or table row, including how its priority
 * score was built — the ranking should never look like a black box.
 */
export function CityDialog({
  city,
  onClose,
}: {
  city: ScoredCity | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!city} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-lg">
        {city ? <CityProfile city={city} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CityProfile({ city }: { city: ScoredCity }) {
  // Demand attributed to each class, which is where the whole argument lives:
  // three-wheelers are a minority of most fleets and the bulk of the energy.
  const byClass = VEHICLE_CLASSES.map((klass) => ({
    klass,
    label: VEHICLE_CLASS_LABELS[klass],
    vehicles: city[klass],
    kwh: city[klass] * DAILY_KWH[klass] * PUBLIC_SHARE_DEFAULTS[klass],
  }));
  const totalDemand = byClass.reduce((sum, c) => sum + c.kwh, 0) || 1;

  return (
    <>
      <DialogHeader className="pr-8">
        <DialogTitle className="text-lg">{city.city}</DialogTitle>
        <DialogDescription>
          {city.state} · {city.id}
        </DialogDescription>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <SeverityBadge severity={city.severity} />
          <span className="text-xs text-muted-foreground">
            {formatCompact(city.deficit_kwh_day)} kWh/day short
          </span>
          <ConfidenceBadge tier={city.registration_confidence} />
        </div>
      </DialogHeader>

      <Group title="Energy balance">
        <Stat
          label="Public charging demand"
          value={`${formatCompact(city.demand_kwh_day)} kWh/day`}
        />
        <Stat
          label="Deliverable supply"
          value={`${formatCompact(city.supply_kwh_day)} kWh/day`}
          note={`${formatNumber(city.total_kw)} kW at ${formatPercent(CAPACITY_UTILISATION)} utilisation`}
        />
        <Stat
          label="Demand vs supply"
          value={`${formatDecimal(city.deficit_ratio, 2)}x`}
          note="1.0 is break-even"
        />
        <Stat
          label="Crossover"
          value={crossoverLabel(city)}
          note={
            city.crossover_year === null && city.ev_growth_rate <= 0
              ? `${formatPercent(city.ev_growth_rate)} YoY — demand never overtakes supply`
              : `at ${formatPercent(city.ev_growth_rate)} YoY fleet growth`
          }
        />
      </Group>

      <Group title="Where the demand comes from">
        <div className="col-span-2 space-y-2">
          {byClass.map((row) => (
            <div key={row.klass} className="flex items-baseline gap-3 text-sm">
              <span className="w-32 shrink-0 text-muted-foreground">{row.label}</span>
              <span className="w-20 shrink-0 tabular-nums">{formatCompact(row.vehicles)}</span>
              <span className="font-medium tabular-nums">
                {formatPercent(row.kwh / totalDemand)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCompact(row.kwh)} kWh/day
              </span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Demand">
        <Stat
          label="Registered EVs"
          value={formatNumber(city.registered_ev)}
          note={`${city.registration_confidence} · ${formatNumber(city.ev_4w)} four-wheelers`}
        />
        <Stat label="EV growth, YoY" value={formatPercent(city.ev_growth_rate)} />
        <Stat label="Population" value={formatPopulation(city.population_lakhs)} />
        <Stat label="Grid renewable share" value={formatPercent(city.renewable_share)} />
      </Group>

      <Group title="Supply">
        <Stat label="Public charging points" value={formatNumber(city.public_chargers)} />
        <Stat
          label="Of which DC fast"
          value={`${formatNumber(city.fast_chargers)} (${formatPercent(
            city.public_chargers ? city.fast_chargers / city.public_chargers : 0
          )})`}
          note="carries most of the capacity"
        />
        <Stat
          label="Per 1,000 EVs"
          value={formatDecimal(city.chargers_per_1000_ev)}
          note="context only — not the ranking"
        />
        <Stat
          label="Mapped in OSM"
          value={`${formatNumber(city.osm_stations)} stations`}
          note="Real stations within 25 km — the basis for this city's share"
        />
      </Group>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-border pt-4">
      <h3 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {title}
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">{children}</dl>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
      {note ? <dd className="text-xs text-muted-foreground">{note}</dd> : null}
    </div>
  );
}
