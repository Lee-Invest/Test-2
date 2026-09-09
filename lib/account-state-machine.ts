/**
 * Account / phase status state machine.
 * =======================================
 * ApexFund tracks challenge progress on `ChallengePhase.status`, which uses
 * the existing `PhaseStatus` enum (PENDING, ACTIVE, PASSED, FAILED, FUNDED,
 * SUSPENDED, PENDING_PAYOUT). This module is the single source of truth for
 * which transitions between those statuses are legal, so no code path can
 * silently move a phase into an inconsistent state (e.g. FAILED -> FUNDED).
 *
 * Deliberately kept as ONE status concept (PhaseStatus on ChallengePhase) —
 * we do NOT introduce a second, separate "AccountStatus" field, because two
 * status trackers on the same entity inevitably drift out of sync.
 * `Account.isActive` remains a simple derived on/off switch used by admin
 * suspend/reactivate actions and is orthogonal to phase progress.
 */

import type { PhaseStatus } from "@prisma/client";

/** Allow-list of legal (status -> status) transitions. Any pair not listed
 * here is rejected unless the caller passes isAdminOverride + is verified
 * ADMIN/SUPER_ADMIN server-side (see requireTransition below). */
const ALLOWED_TRANSITIONS: Record<PhaseStatus, PhaseStatus[]> = {
  PENDING: ["ACTIVE", "SUSPENDED"],
  ACTIVE: ["PASSED", "FAILED", "SUSPENDED"],
  PASSED: ["FUNDED", "ACTIVE" /* next phase starts ACTIVE */],
  FAILED: [], // terminal — only an admin override can move out of FAILED
  FUNDED: ["PENDING_PAYOUT", "SUSPENDED", "FAILED"],
  PENDING_PAYOUT: ["FUNDED"],
  SUSPENDED: ["ACTIVE", "FUNDED", "FAILED"],
};

export class InvalidTransitionError extends Error {
  constructor(from: PhaseStatus, to: PhaseStatus) {
    super(`Illegal phase transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export interface TransitionCaller {
  isAdminOverride?: boolean;
  /** Must be independently verified server-side (requireAdmin()) by the
   * caller before this is ever set true — this module trusts the flag but
   * every call site in this codebase gates it behind requireAdmin(). */
  actorIsAdmin?: boolean;
}

/** Returns true if `from -> to` is on the allow-list (including the no-op
 * case of transitioning to the same status, which is always allowed). */
export function isValidTransition(from: PhaseStatus, to: PhaseStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Validates a transition, throwing InvalidTransitionError unless it is on
 * the allow-list OR the caller is an admin explicitly overriding it. Does
 * NOT perform the write itself — callers apply `to` via prisma after this
 * passes, and must write an AuditLog row when isAdminOverride is used. */
export function assertValidTransition(
  from: PhaseStatus,
  to: PhaseStatus,
  caller: TransitionCaller = {}
): void {
  if (isValidTransition(from, to)) return;
  if (caller.isAdminOverride && caller.actorIsAdmin) return;
  throw new InvalidTransitionError(from, to);
}
