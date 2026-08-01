import Link from "next/link";

import { NAV_ROUTES } from "@/lib/nav";
import { national } from "@/lib/aggregate";
import { formatNumber } from "@/lib/format";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        {/* This previously read "All EV and charging metrics are synthetic and
            illustrative" — left over from an earlier build and false of every
            figure now shipping, on every page of a project whose whole claim is
            that the numbers are published and traceable. */}
        <p className="max-w-md">
          <span className="font-medium text-foreground">EVIP</span> — modelled across{" "}
          {formatNumber(national.cities)} cities in {national.states} states from
          published Ministry of Power, Vahan and OpenStreetMap data.
        </p>
        <nav aria-label="Footer">
          <ul className="-mx-2 flex flex-wrap gap-x-1 gap-y-1">
            {NAV_ROUTES.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  /* py-1.5 clears the 24px target minimum; these sat at 17px. */
                  className="block rounded-md px-2 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
