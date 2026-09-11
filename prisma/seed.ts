import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEMPLATE_DEFAULTS = [
  { accountSize: 10_000, priceCents: 8700 },
  { accountSize: 25_000, priceCents: 13800 },
  { accountSize: 50_000, priceCents: 26300 },
  { accountSize: 100_000, priceCents: 51800 },
  { accountSize: 200_000, priceCents: 102800 },
];

// Explicit ids here MUST match lib/static-platforms.ts / lib/static-addons.ts
// exactly — those files exist so pricing pages can render without a live DB
// round trip, but /api/checkout looks these rows up by id. Without a fixed
// id, upsert would create a random cuid that never matches what the
// static-display layer sends at checkout, and every platform/add-on
// purchase would fail with "no longer available" despite looking fine on
// the page.
const PLATFORM_DEFAULTS = [
  {
    id: "platform-mt4",
    slug: "mt4",
    name: "MetaTrader 4",
    tagline: "The original — simple, reliable, widely supported by third-party tools.",
    features: ["Expert Advisors", "Custom Indicators", "Desktop + Mobile"],
    badges: ["POPULAR"],
    sortOrder: 1,
  },
  {
    id: "platform-mt5",
    slug: "mt5",
    name: "MetaTrader 5",
    tagline: "Advanced charting and a broader instrument set, with full algo support.",
    features: ["Advanced Charting", "Expert Advisors", "Desktop + Mobile + Web"],
    badges: ["BEST FOR EAS"],
    sortOrder: 2,
  },
  {
    id: "platform-ctrader",
    slug: "ctrader",
    name: "cTrader",
    tagline: "Depth-of-market execution and a clean, modern interface.",
    features: ["Level II Pricing", "cAlgo Automation", "Desktop + Mobile + Web"],
    badges: ["WEB"],
    sortOrder: 3,
  },
  {
    id: "platform-match-trader",
    slug: "match-trader",
    name: "Match-Trader",
    tagline: "Fully browser-based — nothing to install.",
    features: ["No Download Required", "Social Trading Feed", "Mobile"],
    badges: ["WEB", "MOBILE"],
    sortOrder: 4,
  },
  {
    id: "platform-dxtrader",
    slug: "dxtrade",
    name: "DXtrade",
    tagline: "Modern multi-asset execution with a fast, customizable web terminal.",
    features: ["Advanced Order Types", "Customizable Layout", "Desktop + Mobile + Web"],
    badges: ["WEB"],
    sortOrder: 5,
  },
  {
    id: "platform-tradingview",
    slug: "tradingview",
    name: "TradingView",
    tagline: "Best-in-class charting, connected directly to your account.",
    features: ["Advanced Charting", "Community Scripts", "Web + Mobile"],
    badges: ["WEB", "MOBILE"],
    sortOrder: 6,
  },
];

const ADDON_DEFAULTS = [
  {
    id: "addon-swap-free",
    slug: "swap-free",
    name: "Swap Free Account",
    description: "No overnight swap/rollover fees on any position — trade multi-day without the carry cost.",
    priceCents: 1900,
    billing: "ONE_TIME" as const,
    sortOrder: 1,
  },
  {
    id: "addon-biweekly-payout",
    slug: "biweekly-payout",
    name: "Bi-Weekly Payout",
    description: "Once funded, request a payout every two weeks instead of the standard cycle.",
    priceCents: 2900,
    billing: "ONE_TIME" as const,
    sortOrder: 2,
  },
  {
    id: "addon-weekly-payout",
    slug: "weekly-payout",
    name: "Weekly Payout",
    description: "Once funded, request a payout every week instead of the standard cycle.",
    priceCents: 4900,
    billing: "ONE_TIME" as const,
    sortOrder: 3,
  },
  {
    id: "addon-monthly-payout",
    slug: "monthly-payout",
    name: "Monthly Payout",
    description: "Once funded, request a payout once a month on a fixed schedule.",
    priceCents: 1500,
    billing: "ONE_TIME" as const,
    sortOrder: 4,
  },
];

// One deliberately-unavailable combination so the availability engine has a
// real case to demonstrate, matching the platform-availability spec: not
// every (account size, platform) pair has to be allowed.
const PLATFORM_UNAVAILABLE: Record<number, string[]> = {
  200_000: ["ctrader"],
};
const PLATFORM_FEES: Record<string, number> = {
  ctrader: 2500,
};

async function main() {
  console.log("Seeding ApexFund database...");

  // ---------------------------------------------------------------------
  // Challenge templates
  // ---------------------------------------------------------------------
  const templates = [];
  for (const t of TEMPLATE_DEFAULTS) {
    const template = await prisma.challengeTemplate.upsert({
      where: { id: `seed-${t.accountSize}` },
      update: {
        priceCents: t.priceCents,
        active: true,
      },
      create: {
        id: `seed-${t.accountSize}`,
        name: `$${t.accountSize.toLocaleString()} Challenge`,
        accountSize: t.accountSize,
        priceCents: t.priceCents,
        phase1ProfitTargetPct: 10,
        phase1MinTradingDays: 4,
        phase2ProfitTargetPct: 5,
        phase2MinTradingDays: 4,
        maxDailyLossPct: 5,
        maxOverallLossPct: 10,
        profitSplitTraderPct: 80,
        dailyResetTimeUtc: "00:00",
      },
    });
    templates.push(template);
  }
  console.log(`Created/updated ${templates.length} challenge templates.`);

  // ---------------------------------------------------------------------
  // Trading platforms + per-account-size availability
  // ---------------------------------------------------------------------
  const platforms = [];
  for (const p of PLATFORM_DEFAULTS) {
    const platform = await prisma.tradingPlatform.upsert({
      where: { id: p.id },
      update: { name: p.name, tagline: p.tagline, features: p.features, badges: p.badges, sortOrder: p.sortOrder },
      create: { ...p, active: true },
    });
    platforms.push(platform);
  }

  for (const template of templates) {
    for (const platform of platforms) {
      const unavailableSlugs = PLATFORM_UNAVAILABLE[template.accountSize] ?? [];
      const allowed = !unavailableSlugs.includes(platform.slug);
      await prisma.platformAvailability.upsert({
        where: { templateId_platformId: { templateId: template.id, platformId: platform.id } },
        update: {
          allowed,
          feeCents: PLATFORM_FEES[platform.slug] ?? 0,
          unavailableReason: allowed ? null : "Not available for this account size.",
        },
        create: {
          templateId: template.id,
          platformId: platform.id,
          allowed,
          feeCents: PLATFORM_FEES[platform.slug] ?? 0,
          unavailableReason: allowed ? null : "Not available for this account size.",
        },
      });
    }
  }
  console.log(`Created/updated ${platforms.length} trading platforms and their availability.`);

  // ---------------------------------------------------------------------
  // Add-ons (available for every account size by default — no
  // AddonAvailability row means "allowed")
  // ---------------------------------------------------------------------
  for (const a of ADDON_DEFAULTS) {
    await prisma.addon.upsert({
      where: { id: a.id },
      update: { name: a.name, description: a.description, priceCents: a.priceCents, sortOrder: a.sortOrder },
      create: { ...a, active: true },
    });
  }
  console.log(`Created/updated ${ADDON_DEFAULTS.length} add-ons.`);

  // ---------------------------------------------------------------------
  // Coupon
  // ---------------------------------------------------------------------
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: { code: "WELCOME10", type: "PERCENT", value: 10, active: true },
  });

  // ---------------------------------------------------------------------
  // Admin user
  // ---------------------------------------------------------------------
  const adminPassword = "Admin123!Change";
  const admin = await prisma.user.upsert({
    where: { email: "admin@apexfund.example" },
    update: {},
    create: {
      email: "admin@apexfund.example",
      name: "ApexFund Admin",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "SUPER_ADMIN",
    },
  });

  // ---------------------------------------------------------------------
  // Demo trader with an active Phase 1 account + trade history
  // ---------------------------------------------------------------------
  const traderPassword = "Trader123!Demo";
  const trader = await prisma.user.upsert({
    where: { email: "trader@apexfund.example" },
    update: {},
    create: {
      email: "trader@apexfund.example",
      name: "Demo Trader",
      passwordHash: await bcrypt.hash(traderPassword, 12),
      role: "TRADER",
    },
  });

  const demoTemplate = templates.find((t) => t.accountSize === 25_000)!;
  const startingBalanceCents = demoTemplate.accountSize * 100;

  const existingAccount = await prisma.account.findFirst({ where: { userId: trader.id } });

  if (!existingAccount) {
    // Simulate a run of trades across several distinct trading days,
    // netting a small profit but not yet hitting the profit target.
    const symbols = ["EURUSD", "GBPUSD", "XAUUSD", "US30", "NAS100"];
    const dayCount = 6;
    let balanceCents = startingBalanceCents;
    let highestBalanceCents = startingBalanceCents;

    const tradesData: {
      symbol: string;
      side: "LONG" | "SHORT";
      volume: number;
      openPrice: number;
      closePrice: number;
      openedAt: Date;
      closedAt: Date;
      pnlCents: number;
    }[] = [];

    const now = Date.now();
    for (let day = dayCount; day >= 1; day--) {
      const tradesThisDay = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < tradesThisDay; i++) {
        const win = Math.random() > 0.45;
        const pnlCents = win
          ? Math.round(5000 + Math.random() * 15000)
          : -Math.round(3000 + Math.random() * 10000);
        balanceCents += pnlCents;
        highestBalanceCents = Math.max(highestBalanceCents, balanceCents);

        const openedAt = new Date(now - day * 24 * 60 * 60 * 1000 + i * 3600 * 1000);
        const closedAt = new Date(openedAt.getTime() + 45 * 60 * 1000);

        tradesData.push({
          symbol: symbols[Math.floor(Math.random() * symbols.length)],
          side: Math.random() > 0.5 ? "LONG" : "SHORT",
          volume: 1,
          openPrice: 100,
          closePrice: 100 + pnlCents / 10000,
          openedAt,
          closedAt,
          pnlCents,
        });
      }
    }

    const account = await prisma.account.create({
      data: {
        userId: trader.id,
        templateId: demoTemplate.id,
        startingBalanceCents,
        currentBalanceCents: balanceCents,
        currentEquityCents: balanceCents,
        highestBalanceCents,
        dayStartEquityCents: balanceCents,
        phases: {
          create: {
            type: "PHASE_1",
            status: "ACTIVE",
            profitTargetPct: demoTemplate.phase1ProfitTargetPct,
            maxDailyLossPct: demoTemplate.maxDailyLossPct,
            maxOverallLossPct: demoTemplate.maxOverallLossPct,
            minTradingDays: demoTemplate.phase1MinTradingDays,
            tradingDays: dayCount,
          },
        },
        trades: { create: tradesData },
      },
    });

    console.log(`Created demo Phase 1 account ${account.id} for trader@apexfund.example`);
  }

  console.log("\n================ SEED CREDENTIALS ================");
  console.log(`Admin:  admin@apexfund.example   / ${adminPassword}`);
  console.log(`Trader: trader@apexfund.example  / ${traderPassword}`);
  console.log("====================================================\n");

  void admin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
