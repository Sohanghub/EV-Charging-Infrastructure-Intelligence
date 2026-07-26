import Link from "next/link";

import { NAV_ROUTES } from "@/lib/nav";
import { national } from "@/lib/aggregate";
import { formatNumber } from "@/lib/format";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-md">
          <span className="font-medium text-foreground">ECII</span> — modelled across{" "}
          {formatNumber(national.cities)} cities in {national.states} states. All EV and
          charging metrics are synthetic and illustrative.
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {NAV_ROUTES.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="rounded-sm transition-colors hover:text-foreground">
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
