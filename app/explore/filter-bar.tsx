"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { METRIC_LIST, type MetricKey } from "@/lib/metrics";

export const ALL_STATES = "all";

interface FilterBarProps {
  states: readonly string[];
  state: string;
  onStateChange: (state: string) => void;
  metric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
  /** Cities currently passing the filters, for the result count. */
  matches: number;
  total: number;
}

export function FilterBar({
  states,
  state,
  onStateChange,
  metric,
  onMetricChange,
  matches,
  total,
}: FilterBarProps) {
  const stateItems = [
    { value: ALL_STATES, label: "All states" },
    ...states.map((s) => ({ value: s, label: s })),
  ];
  const metricItems = METRIC_LIST.map((m) => ({ value: m.key, label: m.label }));
  const filtered = state !== ALL_STATES;

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-border bg-card p-3">
      <Field label="State" htmlFor="filter-state">
        <Select
          items={stateItems}
          value={state}
          onValueChange={(value) => onStateChange(value as string)}
        >
          <SelectTrigger id="filter-state" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stateItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Map & chart metric" htmlFor="filter-metric">
        <Select
          items={metricItems}
          value={metric}
          onValueChange={(value) => onMetricChange(value as MetricKey)}
        >
          <SelectTrigger id="filter-metric" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {metricItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <p className="ml-auto pb-1.5 text-xs text-muted-foreground" aria-live="polite">
        {matches === total ? `${total} cities` : `${matches} of ${total} cities`}
      </p>

      {filtered ? (
        <Button variant="ghost" size="sm" onClick={() => onStateChange(ALL_STATES)}>
          <RotateCcw className="size-3.5" aria-hidden />
          Reset
        </Button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
