export interface StaticPlatform {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  features: string[];
  badges: string[];
}

// Static display data mirroring the seeded TradingPlatform rows (see
// prisma/seed.ts). The configurator reads from this constant instead of
// fetching /api/platforms, so the platform step renders instantly and never
// gets stuck on a loading/error state if the database is briefly
// unavailable or not yet migrated/seeded. Checkout still validates the
// chosen platform against the real PlatformAvailability table server-side —
// the frontend never decides what's actually allowed, only what it
// displays before checkout.
export const STATIC_PLATFORMS: StaticPlatform[] = [
  {
    id: "platform-mt4",
    name: "MetaTrader 4",
    slug: "mt4",
    tagline: "The original — simple, reliable, widely supported by third-party tools.",
    features: ["Expert Advisors", "Custom Indicators", "Desktop + Mobile"],
    badges: ["POPULAR"],
  },
  {
    id: "platform-mt5",
    name: "MetaTrader 5",
    slug: "mt5",
    tagline: "Advanced charting and a broader instrument set, with full algo support.",
    features: ["Advanced Charting", "Expert Advisors", "Desktop + Mobile + Web"],
    badges: ["BEST FOR EAS"],
  },
  {
    id: "platform-ctrader",
    name: "cTrader",
    slug: "ctrader",
    tagline: "Depth-of-market execution and a clean, modern interface.",
    features: ["Level II Pricing", "cAlgo Automation", "Desktop + Mobile + Web"],
    badges: ["WEB"],
  },
  {
    id: "platform-match-trader",
    name: "Match-Trader",
    slug: "match-trader",
    tagline: "Fully browser-based — nothing to install.",
    features: ["No Download Required", "Social Trading Feed", "Mobile"],
    badges: ["WEB", "MOBILE"],
  },
];

// Mirrors the seeded PlatformAvailability rows: cTrader carries a $25 fee
// everywhere and is blocked outright on the $200K template.
export interface StaticAvailability {
  templateId: string;
  platformId: string;
  allowed: boolean;
  feeCents: number;
  unavailableReason: string | null;
}

export const STATIC_PLATFORM_AVAILABILITY: StaticAvailability[] = (
  ["seed-10000", "seed-25000", "seed-50000", "seed-100000", "seed-200000"] as const
).flatMap((templateId) =>
  STATIC_PLATFORMS.map((platform) => {
    const blocked = templateId === "seed-200000" && platform.slug === "ctrader";
    return {
      templateId,
      platformId: platform.id,
      allowed: !blocked,
      feeCents: platform.slug === "ctrader" ? 2500 : 0,
      unavailableReason: blocked ? "Not available for this account size." : null,
    };
  })
);
