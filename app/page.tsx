import { IndiaMap } from "@/components/map/india-map";
import { SectionHeading } from "@/components/section-heading";
import { scoredCities } from "@/lib/aggregate";
import { HeroSection } from "./hero-section";
import { QuickLinks } from "./quick-links";

export default function HomePage() {
  return (
    <>
      <HeroSection />

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-14 sm:px-6">
        <section className="space-y-5">
          <SectionHeading
            eyebrow="National view"
            title="The shortfall is not spread evenly"
            description="Colour shows how far a city sits from the one-per-250-EV benchmark. Circle size shows how many charging points it is short — the largest red circles are where investment buys the most relief."
          />
          {/* One IndiaMap, configured by props. Explore uses the same component. */}
          <IndiaMap
            cities={scoredCities}
            colorBy="deficit_ratio"
            sizeBy="demand_kwh_day"
            height="h-[440px] md:h-[620px]"
          />
        </section>

        <section className="space-y-5">
          <SectionHeading
            title="Where to go next"
            description="Three ways into the same dataset."
          />
          <QuickLinks />
        </section>
      </div>
    </>
  );
}
