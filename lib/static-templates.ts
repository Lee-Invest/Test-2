export interface StaticTemplate {
  id: string;
  name: string;
  accountSize: number;
  priceCents: number;
  phase1ProfitTargetPct: string;
  phase2ProfitTargetPct: string;
  maxDailyLossPct: string;
  maxOverallLossPct: string;
  phase1MinTradingDays: number;
  phase2MinTradingDays: number;
  profitSplitTraderPct: string;
}

// Static display data matching the default seeded ChallengeTemplate rows
// (see prisma/seed.ts). Pricing pages read from this constant instead of
// fetching /api/templates, so they render instantly and never get stuck on
// a loading state if the database or API is briefly unavailable.
//
// Checkout still hits the real /api/checkout route with the id below, which
// validates and prices the order server-side from the database — the
// frontend never decides the actual price or rules, only what it displays
// before checkout. If an admin changes a template's price or rules via the
// admin panel, update the values here to match, or the marketing display
// and the real checkout will drift apart.
export const STATIC_TEMPLATES: StaticTemplate[] = [
  {
    id: "seed-10000",
    name: "$10,000 Challenge",
    accountSize: 10_000,
    priceCents: 8_700,
    phase1ProfitTargetPct: "10",
    phase2ProfitTargetPct: "5",
    maxDailyLossPct: "5",
    maxOverallLossPct: "10",
    phase1MinTradingDays: 4,
    phase2MinTradingDays: 4,
    profitSplitTraderPct: "80",
  },
  {
    id: "seed-25000",
    name: "$25,000 Challenge",
    accountSize: 25_000,
    priceCents: 13_800,
    phase1ProfitTargetPct: "10",
    phase2ProfitTargetPct: "5",
    maxDailyLossPct: "5",
    maxOverallLossPct: "10",
    phase1MinTradingDays: 4,
    phase2MinTradingDays: 4,
    profitSplitTraderPct: "80",
  },
  {
    id: "seed-50000",
    name: "$50,000 Challenge",
    accountSize: 50_000,
    priceCents: 31_000,
    phase1ProfitTargetPct: "10",
    phase2ProfitTargetPct: "5",
    maxDailyLossPct: "5",
    maxOverallLossPct: "10",
    phase1MinTradingDays: 4,
    phase2MinTradingDays: 4,
    profitSplitTraderPct: "80",
  },
  {
    id: "seed-100000",
    name: "$100,000 Challenge",
    accountSize: 100_000,
    priceCents: 51_800,
    phase1ProfitTargetPct: "10",
    phase2ProfitTargetPct: "5",
    maxDailyLossPct: "5",
    maxOverallLossPct: "10",
    phase1MinTradingDays: 4,
    phase2MinTradingDays: 4,
    profitSplitTraderPct: "80",
  },
  {
    id: "seed-200000",
    name: "$200,000 Challenge",
    accountSize: 200_000,
    priceCents: 102_800,
    phase1ProfitTargetPct: "10",
    phase2ProfitTargetPct: "5",
    maxDailyLossPct: "5",
    maxOverallLossPct: "10",
    phase1MinTradingDays: 4,
    phase2MinTradingDays: 4,
    profitSplitTraderPct: "80",
  },
];
