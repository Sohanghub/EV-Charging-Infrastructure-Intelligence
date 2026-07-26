import { ArrowUpRight, BookOpen, Map, Target } from "lucide-react";
import Link from "next/link";

const LINKS = [
  {
    href: "/explore",
    icon: Map,
    title: "Explore demand vs supply",
    body: "Filter by state, switch the metric driving the map, and compare every city side by side.",
  },
  {
    href: "/recommendations",
    icon: Target,
    title: "Allocate an investment",
    body: "Set a station budget and see exactly how it should be split across the 15 highest-priority cities.",
  },
  {
    href: "/methodology",
    icon: BookOpen,
    title: "Check the method",
    body: "Every benchmark, weight and assumption behind the ranking, written out in full.",
  },
] as const;

export function QuickLinks() {
  return (
    <nav aria-label="Sections" className="grid gap-3 sm:grid-cols-3">
      {LINKS.map(({ href, icon: Icon, title, body }) => (
        <Link
          key={href}
          href={href}
          className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/25 hover:bg-accent/40"
        >
          <span className="flex items-center justify-between">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            <ArrowUpRight
              className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
          <span className="mt-3 font-medium">{title}</span>
          <span className="mt-1.5 text-sm text-muted-foreground">{body}</span>
        </Link>
      ))}
    </nav>
  );
}
