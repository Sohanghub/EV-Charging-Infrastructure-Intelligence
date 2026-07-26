/** Shared by the header and the footer, so the two can never disagree. */
export const NAV_ROUTES = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/methodology", label: "Methodology" },
] as const;
