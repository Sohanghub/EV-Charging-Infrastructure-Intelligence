"use client";

import { SeverityBadge } from "@/components/severity-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AC_POINTS_PER_STATION, FAST_POINTS_PER_STATION } from "@/lib/constants";
import { crossoverLabel } from "@/lib/scoring";
import {
  formatCompact,
  formatDecimal,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { Allocation } from "@/lib/types";

/**
 * The ranking, in allocation order. Deliberately not sortable — this table is
 * the output of the allocation rule, and its order is the recommendation.
 */
export function PriorityTable({ allocations }: { allocations: Allocation[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <caption className="sr-only">
          The fifteen highest-priority cities, the stations allocated to each, and the
          modelled effect on their energy deficit.
        </caption>
        <TableHeader className="[&_th]:bg-card">
          <TableRow>
            <TableHead className="w-10" data-numeric>
              #
            </TableHead>
            <TableHead>City</TableHead>
            <TableHead>Coverage</TableHead>
            <TableHead data-numeric title="Priority score">
              Priority
            </TableHead>
            <TableHead data-numeric title="Public charging points today">
              Existing
            </TableHead>
            <TableHead data-numeric>Stations</TableHead>
            <TableHead
              data-numeric
              title={`${FAST_POINTS_PER_STATION} DC fast + ${AC_POINTS_PER_STATION} AC per station`}
            >
              New points
            </TableHead>
            <TableHead data-numeric title="Unmet public charging energy today, kWh/day">
              Gap before
            </TableHead>
            <TableHead
              data-numeric
              title="Unmet energy still outstanding after the funded build, kWh/day"
            >
              Gap after
            </TableHead>
            <TableHead data-numeric>Closed</TableHead>
            <TableHead data-numeric title="Years until demand overtakes installed supply">
              Crossover
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocations.map((a, index) => (
            <TableRow key={a.city.id}>
              <TableCell data-numeric className="text-muted-foreground">
                {index + 1}
              </TableCell>
              <TableCell>
                <span className="font-medium">{a.city.city}</span>
                <span className="block text-xs text-muted-foreground">{a.city.state}</span>
              </TableCell>
              <TableCell>
                <SeverityBadge severity={a.city.severity} />
              </TableCell>
              <TableCell data-numeric>{formatDecimal(a.city.priority_score)}</TableCell>
              <TableCell data-numeric className="text-muted-foreground">
                {formatNumber(a.city.public_chargers)}
              </TableCell>
              <TableCell data-numeric className="font-medium">
                {formatNumber(a.stations)}
              </TableCell>
              <TableCell data-numeric className="text-chart-2">
                +{formatNumber(a.charging_points)}
              </TableCell>
              <TableCell data-numeric className="text-muted-foreground">
                {formatCompact(Math.max(0, a.city.deficit_kwh_day))}
              </TableCell>
              <TableCell data-numeric>{formatCompact(a.deficit_after)}</TableCell>
              <TableCell data-numeric className="font-medium">
                {formatPercent(a.deficit_closure)}
              </TableCell>
              <TableCell data-numeric>
                <span className={a.city.crossover_year === null ? "text-muted-foreground" : ""}>
                  {crossoverLabel(a.city)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
