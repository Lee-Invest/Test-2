import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { PhaseStatus, PhaseType } from "@prisma/client";

function generateCredentials(platformName: string | undefined, accountId: string) {
  const login = `1${accountId.replace(/[^0-9]/g, "").slice(0, 7).padEnd(7, "0")}`;
  const serverName = `ApexFund-${(platformName ?? "Live").replace(/\s+/g, "")}-01`;
  const password = crypto.randomBytes(6).toString("base64url");
  return { login, serverName, password };
}

/**
 * Provisions a paid Order into a live trading Account. Called from the
 * Stripe webhook handler once `checkout.session.completed` has been
 * verified. Idempotent: if the order already has an account, does nothing
 * further.
 *
 * The chosen ChallengeProgram's phaseCount decides the starting shape:
 *   2 (default / no program) -> standard Phase 1 -> Phase 2 -> Funded
 *   1                        -> a single evaluation phase before funding
 *   0                        -> funded immediately, no evaluation phase
 * This is read from the program row, never hardcoded per template.
 */
export async function provisionOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { template: true, account: true, program: true, platform: true },
  });

  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.account) return order.account; // already provisioned

  const startingBalanceCents = order.template.accountSize * 100;
  const phaseCount = order.program?.phaseCount ?? 2;

  const firstPhase: { type: PhaseType; status: PhaseStatus; profitTargetPct: number } =
    phaseCount === 0
      ? { type: "FUNDED", status: "FUNDED", profitTargetPct: 0 }
      : phaseCount === 1
      ? { type: "PHASE_1", status: "ACTIVE", profitTargetPct: Number(order.template.phase1ProfitTargetPct) }
      : { type: "PHASE_1", status: "ACTIVE", profitTargetPct: Number(order.template.phase1ProfitTargetPct) };

  const account = await prisma.account.create({
    data: {
      userId: order.userId,
      templateId: order.templateId,
      programId: order.programId,
      orderId: order.id,
      platformId: order.platformId,
      startingBalanceCents,
      currentBalanceCents: startingBalanceCents,
      currentEquityCents: startingBalanceCents,
      highestBalanceCents: startingBalanceCents,
      dayStartEquityCents: startingBalanceCents,
      phases: {
        create: {
          type: firstPhase.type,
          status: firstPhase.status,
          profitTargetPct: firstPhase.profitTargetPct,
          maxDailyLossPct: order.template.maxDailyLossPct,
          maxOverallLossPct: order.template.maxOverallLossPct,
          minTradingDays: firstPhase.type === "FUNDED" ? 0 : order.template.phase1MinTradingDays,
        },
      },
    },
    include: { phases: true },
  });

  const creds = generateCredentials(order.platform?.name, account.id);
  await prisma.account.update({
    where: { id: account.id },
    data: {
      platformLogin: creds.login,
      platformServerName: creds.serverName,
      platformPasswordDisplay: creds.password,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PAID" },
  });

  await prisma.notification.create({
    data: {
      userId: order.userId,
      type: "SUCCESS",
      title: "Your challenge account is live",
      body:
        firstPhase.type === "FUNDED"
          ? `Your $${order.template.accountSize.toLocaleString()} funded account has been created. Good luck!`
          : `Your $${order.template.accountSize.toLocaleString()} ${firstPhase.type.replace("_", " ")} account has been created. Good luck!`,
    },
  });

  return account;
}
