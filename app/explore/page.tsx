import type { Metadata } from "next";

import { SectionHeading } from "@/components/section-heading";
import { scoredCities, stateNames } from "@/lib/aggregate";
import { ExploreView } from "./explore-view";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Compare EV demand against public charging supply across 100 Indian cities and 20 states.",
};

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <SectionHeading
        as="h1"
        eyebrow="Explore"
        title="Demand against supply"
        description="Filter to a state, choose the metric driving the map and charts, then read the detail in the table. Selecting a city anywhere opens its full profile."
      />
      <ExploreView cities={scoredCities} states={stateNames} />
    </div>
  );
}
