import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  /** Small uppercase label above the title. */
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Controls that belong with the section — filters, toggles, links. */
  action?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  as: Tag = "h2",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-1.5 text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <Tag
          className={cn(
            "text-balance font-semibold tracking-tight",
            Tag === "h1" ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"
          )}
        >
          {title}
        </Tag>
        {description ? (
          <p
            className={cn(
              "text-pretty text-sm text-muted-foreground sm:text-[0.9375rem]",
              Tag === "h1" ? "mt-3" : "mt-1.5"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
