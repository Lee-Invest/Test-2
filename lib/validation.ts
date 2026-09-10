import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});

export const checkoutSchema = z.object({
  templateId: z.string().min(1),
  couponCode: z.string().optional(),
  platformId: z.string().optional(),
  agreedToRules: z.literal(true, {
    message: "You must agree to the Funded Trader Agreement and Trading Rules to continue.",
  }),
});

export const templateUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  accountSize: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
  active: z.boolean().optional(),
  phase1ProfitTargetPct: z.number().positive(),
  phase1MinTradingDays: z.number().int().nonnegative(),
  phase2ProfitTargetPct: z.number().positive(),
  phase2MinTradingDays: z.number().int().nonnegative(),
  maxDailyLossPct: z.number().positive(),
  maxOverallLossPct: z.number().positive(),
  profitSplitTraderPct: z.number().positive().max(100),
  dailyResetTimeUtc: z.string().regex(/^\d{2}:\d{2}$/),
});

export const couponUpsertSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2).max(40),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().positive(),
  active: z.boolean().optional(),
  maxRedemptions: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  templateId: z.string().optional().nullable(),
});

export const accountAdminActionSchema = z.object({
  accountId: z.string().min(1),
  action: z.enum(["SUSPEND", "REACTIVATE", "RESET", "CLOSE", "MARK_FUNDED", "SET_PHASE", "MARK_REFUNDED"]),
  phase: z.enum(["PHASE_1", "PHASE_2", "FUNDED"]).optional(),
});

export const payoutActionSchema = z
  .object({
    payoutId: z.string().min(1),
    action: z.enum(["APPROVE", "REJECT", "MARK_PAID", "UNDER_REVIEW", "PROCESSING", "CANCEL"]),
    notes: z.string().optional(),
    rejectionReason: z.string().min(1).optional(),
  })
  .refine((v) => v.action !== "REJECT" || (v.rejectionReason && v.rejectionReason.trim().length > 0), {
    message: "rejectionReason is required when rejecting a payout.",
    path: ["rejectionReason"],
  });
