import type { PhaseType } from "./risk-engine.types";

/** Given the phase a trader just passed, returns the next phase type, or
 * null if there is no next phase (FUNDED is terminal). Phase transitions
 * always restart with the SAME starting balance as the original challenge.
 *
 * `phaseCount` comes from the account's ChallengeProgram (2 = standard
 * two-phase evaluation, 1 = a single phase before funding, 0 = never
 * reaches this function since it starts already FUNDED) — a 1-Step program
 * skips PHASE_2 entirely, going straight from PHASE_1 to FUNDED. Defaults
 * to 2 for accounts with no program set (the original behavior). */
export function nextPhase(current: PhaseType, phaseCount = 2): PhaseType | null {
  switch (current) {
    case "PHASE_1":
      return phaseCount <= 1 ? "FUNDED" : "PHASE_2";
    case "PHASE_2":
      return "FUNDED";
    case "FUNDED":
      return null;
  }
}
