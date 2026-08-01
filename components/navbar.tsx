"use client";

import { Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_ROUTES } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="-my-1 flex shrink-0 items-center gap-2 rounded-md py-1 text-sm font-semibold tracking-tight"
        >
          <Zap className="size-4 text-chart-2" aria-hidden />
          EVIP
          <span className="hidden font-normal text-muted-foreground lg:inline">
            EV Charging Infrastructure Intelligence
          </span>
        </Link>

        {/* Scrolls rather than collapsing into a menu; starts at the first link
            on narrow screens so nothing important is hidden off-screen. */}
        <nav aria-label="Primary" className="-mx-1 flex-1 overflow-x-auto">
          <ul className="flex items-center justify-start gap-0.5 sm:justify-end sm:gap-1">
            {NAV_ROUTES.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-[0.8125rem] whitespace-nowrap transition-colors sm:px-2.5 sm:text-sm",
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
