export interface StaticAddon {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  billing: "ONE_TIME" | "MONTHLY";
}

// Static display data mirroring the seeded Addon rows (see prisma/seed.ts).
// Same rationale as static-platforms.ts / static-templates.ts — instant,
// reliable display, decoupled from the live database. Every add-on here is
// allowed for every account size by default (matching seed.ts, which
// creates no blocking AddonAvailability rows), and checkout still validates
// server-side against the real tables.
export const STATIC_ADDONS: StaticAddon[] = [
  {
    id: "addon-priority-support",
    name: "Priority Support",
    slug: "priority-support",
    description: "Skip the queue — faster response times from the support team.",
    priceCents: 1900,
    billing: "ONE_TIME",
  },
  {
    id: "addon-performance-analytics",
    name: "Performance Analytics",
    slug: "performance-analytics",
    description: "Deeper trade breakdowns: drawdown curves, R-multiples, and session heatmaps.",
    priceCents: 2900,
    billing: "ONE_TIME",
  },
  {
    id: "addon-reset-protection",
    name: "Reset Protection",
    slug: "reset-protection",
    description: "One free challenge reset if you fail your first evaluation attempt.",
    priceCents: 3900,
    billing: "ONE_TIME",
  },
];
