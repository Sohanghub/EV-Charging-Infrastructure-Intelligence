"use client";

import {
  CHARGING_POINTS_PER_STATION,
  SLIDER_MAX_STATIONS,
  SLIDER_MIN_STATIONS,
  SLIDER_STEP_STATIONS,
} from "@/lib/constants";
import { formatNumber } from "@/lib/format";

const TICKS = [25, 250, 500, 750, 1000];

/**
 * A native range input. It is already keyboard operable, announces its value,
 * and needs no library — only the thumb and track are restyled.
 */
export function InvestmentSlider({
  stations,
  onChange,
}: {
  stations: number;
  onChange: (stations: number) => void;
}) {
  const points = stations * CHARGING_POINTS_PER_STATION;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label htmlFor="investment" className="text-sm font-medium">
          Stations to fund
        </label>
        <p className="text-sm text-muted-foreground">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {formatNumber(stations)}
          </span>{" "}
          stations ={" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatNumber(points)}
          </span>{" "}
          charging points
        </p>
      </div>

      <input
        id="investment"
        type="range"
        min={SLIDER_MIN_STATIONS}
        max={SLIDER_MAX_STATIONS}
        step={SLIDER_STEP_STATIONS}
        value={stations}
        onChange={(event) => onChange(Number(event.target.value))}
        list="investment-ticks"
        aria-valuetext={`${stations} stations, ${points} charging points`}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-chart-2"
      />
      <datalist id="investment-ticks">
        {TICKS.map((tick) => (
          <option key={tick} value={tick} label={String(tick)} />
        ))}
      </datalist>

      <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
        {TICKS.map((tick) => (
          <button
            key={tick}
            type="button"
            onClick={() => onChange(tick)}
            className="rounded-sm px-1 transition-colors hover:text-foreground"
          >
            {tick}
          </button>
        ))}
      </div>
    </div>
  );
}
