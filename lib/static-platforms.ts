export interface StaticPlatform {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  features: string[];
  badges: string[];
  // Whether trades can actually be placed on this platform, or it's
  // analysis-only (e.g. TradingView without a broker execution integration
  // configured). Never assume a charting platform supports execution.
  mode: "EXECUTION" | "ANALYSIS_ONLY";
  compare: {
    web: boolean;
    desktop: boolean;
    mobile: boolean;
    eas: boolean;
    algoTrading: boolean;
    advancedCharts: boolean;
    oneClickTrading: boolean;
    marketExecution: boolean;
    customIndicators: boolean;
  };
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
    mode: "EXECUTION",
    compare: {
      web: false,
      desktop: true,
      mobile: true,
      eas: true,
      algoTrading: true,
      advancedCharts: false,
      oneClickTrading: true,
      marketExecution: true,
      customIndicators: true,
    },
  },
  {
    id: "platform-mt5",
    name: "MetaTrader 5",
    slug: "mt5",
    tagline: "Advanced charting and a broader instrument set, with full algo support.",
    features: ["Advanced Charting", "Expert Advisors", "Desktop + Mobile + Web"],
    badges: ["BEST FOR EAS"],
    mode: "EXECUTION",
    compare: {
      web: true,
      desktop: true,
      mobile: true,
      eas: true,
      algoTrading: true,
      advancedCharts: true,
      oneClickTrading: true,
      marketExecution: true,
      customIndicators: true,
    },
  },
  {
    id: "platform-ctrader",
    name: "cTrader",
    slug: "ctrader",
    tagline: "Depth-of-market execution and a clean, modern interface.",
    features: ["Level II Pricing", "cAlgo Automation", "Desktop + Mobile + Web"],
    badges: ["WEB"],
    mode: "EXECUTION",
    compare: {
      web: true,
      desktop: true,
      mobile: true,
      eas: false,
      algoTrading: true,
      advancedCharts: true,
      oneClickTrading: true,
      marketExecution: true,
      customIndicators: true,
    },
  },
  {
    id: "platform-match-trader",
    name: "Match-Trader",
    slug: "match-trader",
    tagline: "Fully browser-based — nothing to install.",
    features: ["No Download Required", "Social Trading Feed", "Mobile"],
    badges: ["WEB", "MOBILE"],
    mode: "EXECUTION",
    compare: {
      web: true,
      desktop: false,
      mobile: true,
      eas: false,
      algoTrading: false,
      advancedCharts: true,
      oneClickTrading: true,
      marketExecution: true,
      customIndicators: false,
    },
  },
  {
    id: "platform-tradingview",
    name: "TradingView",
    slug: "tradingview",
    tagline: "Best-in-class charting for analysis alongside your execution platform.",
    features: ["Advanced Charting", "Community Scripts", "Web + Mobile"],
    badges: ["WEB", "MOBILE", "ANALYSIS ONLY"],
    // No broker execution bridge is configured for this environment — shown
    // for chart analysis only, never selectable as the account's execution
    // platform. Configure a real bridge before ever changing this.
    mode: "ANALYSIS_ONLY",
    compare: {
      web: true,
      desktop: false,
      mobile: true,
      eas: false,
      algoTrading: false,
      advancedCharts: true,
      oneClickTrading: false,
      marketExecution: false,
      customIndicators: true,
    },
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
