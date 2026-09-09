import type { PhaseType } from "./risk-engine.types";

/** Given the phase a trader just passed, returns the next phase type, or
 * null if there is no next phase (FUNDED is terminal). Phase transitions
 * always restart with the SAME starting balance as the original challenge. */
export function nextPhase(current: PhaseType): PhaseType | null {
  switch (current) {
    case "PHASE_1":
      return "PHASE_2";
    case "PHASE_2":
      return "FUNDED";
    case "FUNDED":
      return null;
  }
}
