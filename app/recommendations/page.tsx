import type { Metadata } from "next";

import { scoredCities } from "@/lib/aggregate";
import { RecommendationsView } from "./recommendations-view";

export const metadata: Metadata = {
  title: "Recommendations",
  description:
    "Allocate a fixed number of new charging stations across India's highest-priority cities and see the modelled effect on their daily energy deficit.",
};

export default function RecommendationsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <RecommendationsView cities={scoredCities} />
    </div>
  );
}
