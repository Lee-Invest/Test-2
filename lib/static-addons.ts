export interface StaticAddon {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  billing: "ONE_TIME" | "MONTHLY";
}

// Static display data mirroring the seeded Addon rows (see prisma/seed.ts).
// The `id` here MUST match the real database row's id exactly (seed.ts
// creates these rows with these exact explicit ids, not an auto-generated
// one) — /api/checkout looks addons up by this id, so a mismatch would make
// every add-on purchase fail with "no longer available" despite looking
// selectable on the page. Checkout still re-validates against the real
// tables server-side; this only decouples display from a live DB round trip.
export const STATIC_ADDONS: StaticAddon[] = [
  {
    id: "addon-swap-free",
    name: "Swap Free Account",
    slug: "swap-free",
    description: "No overnight swap/rollover fees on any position — trade multi-day without the carry cost.",
    priceCents: 1900,
    billing: "ONE_TIME",
  },
  {
    id: "addon-biweekly-payout",
    name: "Bi-Weekly Payout",
    slug: "biweekly-payout",
    description: "Once funded, request a payout every two weeks instead of the standard cycle.",
    priceCents: 2900,
    billing: "ONE_TIME",
  },
  {
    id: "addon-weekly-payout",
    name: "Weekly Payout",
    slug: "weekly-payout",
    description: "Once funded, request a payout every week instead of the standard cycle.",
    priceCents: 4900,
    billing: "ONE_TIME",
  },
  {
    id: "addon-monthly-payout",
    name: "Monthly Payout",
    slug: "monthly-payout",
    description: "Once funded, request a payout once a month on a fixed schedule.",
    priceCents: 1500,
    billing: "ONE_TIME",
  },
];
