"use client";

import {
  DAILY_KWH,
  PUBLIC_SHARE_MAX,
  PUBLIC_SHARE_MIN,
  PUBLIC_SHARE_STEP,
  THREE_WHEELER_BREAKEVEN_KWH,
  VEHICLE_CLASS_LABELS,
  VEHICLE_CLASSES,
} from "@/lib/constants";
import { formatDecimal, formatPercent } from "@/lib/format";
import type { PublicShares } from "@/lib/types";

/**
 * The share of each class's energy drawn from public charging points — the
 * parameter nobody has measured, and the one the national result turns on.
 *
 * The three-wheeler row carries a threshold marker at 1.99 kWh/day. That figure
 * is published in energy rather than as a share deliberately: a share needs an
 * assumed daily total to mean anything, and that denominator silently decides
 * the answer. kWh/day is checkable without it.
 */
export function PublicShareSliders({
  shares,
  onChange,
}: {
  shares: PublicShares;
  onChange: (next: PublicShares) => void;
}) {
  const threeWheelerDraw = DAILY_KWH.ev_3w * shares.ev_3w;
  const past = threeWheelerDraw >= THREE_WHEELER_BREAKEVEN_KWH;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Public charging share by class</h3>
        <p className="text-xs text-muted-foreground">
          Not measured anywhere. Move these and the map re-bands.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {VEHICLE_CLASSES.map((klass) => {
          const draw = DAILY_KWH[klass] * shares[klass];
          return (
            <div key={klass} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3">
              <label htmlFor={`share-${klass}`} className="text-xs text-muted-foreground">
                {VEHICLE_CLASS_LABELS[klass]}
              </label>
              <input
                id={`share-${klass}`}
                type="range"
                min={PUBLIC_SHARE_MIN}
                max={PUBLIC_SHARE_MAX}
                step={PUBLIC_SHARE_STEP}
                value={shares[klass]}
                onChange={(e) =>
                  onChange({ ...shares, [klass]: Number(e.target.value) })
                }
                className="accent-chart-2"
              />
              <span className="w-28 text-right text-xs tabular-nums">
                <span className="font-medium">{formatPercent(shares[klass])}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {formatDecimal(draw, 2)} kWh
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-border pt-3 text-xs text-pretty text-muted-foreground">
        National break-even is{" "}
        <strong className="font-semibold text-foreground">
          {THREE_WHEELER_BREAKEVEN_KWH} kWh/day per three-wheeler
        </strong>
        . At {formatPercent(shares.ev_3w)} they draw {formatDecimal(threeWheelerDraw, 2)}{" "}
        kWh/day, which is{" "}
        <strong className={past ? "font-semibold text-chart-4" : "font-semibold text-chart-2"}>
          {past ? "above" : "below"}
        </strong>{" "}
        it — India is in {past ? "deficit" : "surplus"} at this assumption.
      </p>
    </section>
  );
}
