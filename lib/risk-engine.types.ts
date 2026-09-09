// Lightweight standalone enum mirrors of the Prisma schema, so pure lib
// modules (risk-engine, phase-transition) don't need a generated Prisma
// client to be importable/testable.

export type PhaseType = "PHASE_1" | "PHASE_2" | "FUNDED";
export type PhaseStatus =
  | "PENDING"
  | "ACTIVE"
  | "PASSED"
  | "FAILED"
  | "FUNDED"
  | "SUSPENDED"
  | "PENDING_PAYOUT";
