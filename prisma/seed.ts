import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEMPLATE_DEFAULTS = [
  { accountSize: 10_000, priceCents: 8700 },
  { accountSize: 25_000, priceCents: 13800 },
  { accountSize: 50_000, priceCents: 31000 },
  { accountSize: 100_000, priceCents: 51800 },
  { accountSize: 200_000, priceCents: 102800 },
];

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
