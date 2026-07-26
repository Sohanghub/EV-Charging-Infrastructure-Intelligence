import { cn } from "@/lib/utils";

/**
 * Shared chart shell: title, one line of explanation, fixed height. Charts stay
 * minimal — no chart draws its own card border or legend chrome.
 */
export function ChartFrame({
  title,
  description,
  height = "h-64",
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  height?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={cn("rounded-lg border border-border bg-card p-4", className)}
    >
      <figcaption className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </figcaption>
      <div className={cn("mt-4 w-full", height)}>{children}</div>
    </figure>
  );
}
