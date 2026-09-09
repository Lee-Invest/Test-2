import { describe, it, expect } from "vitest";
import { isValidTransition, assertValidTransition, InvalidTransitionError } from "./account-state-machine";

describe("account-state-machine", () => {
  it("allows documented forward transitions", () => {
    expect(isValidTransition("PENDING", "ACTIVE")).toBe(true);
    expect(isValidTransition("ACTIVE", "PASSED")).toBe(true);
    expect(isValidTransition("PASSED", "FUNDED")).toBe(true);
    expect(isValidTransition("FUNDED", "PENDING_PAYOUT")).toBe(true);
    expect(isValidTransition("PENDING_PAYOUT", "FUNDED")).toBe(true);
  });

  it("allows a no-op same-status transition", () => {
    expect(isValidTransition("ACTIVE", "ACTIVE")).toBe(true);
  });

  it("rejects FAILED -> FUNDED", () => {
    expect(isValidTransition("FAILED", "FUNDED")).toBe(false);
    expect(() => assertValidTransition("FAILED", "FUNDED")).toThrow(InvalidTransitionError);
  });

  it("rejects an out-of-order jump", () => {
    expect(isValidTransition("PENDING", "FUNDED")).toBe(false);
  });

  it("allows an explicit, verified admin override past the allow-list", () => {
    expect(() =>
      assertValidTransition("FAILED", "FUNDED", { isAdminOverride: true, actorIsAdmin: true })
    ).not.toThrow();
  });

  it("rejects an override claim that isn't actually verified as admin", () => {
    expect(() =>
      assertValidTransition("FAILED", "FUNDED", { isAdminOverride: true, actorIsAdmin: false })
    ).toThrow(InvalidTransitionError);
  });

  it("FAILED is terminal with no non-override transitions", () => {
    expect(isValidTransition("FAILED", "ACTIVE")).toBe(false);
    expect(isValidTransition("FAILED", "PASSED")).toBe(false);
    expect(isValidTransition("FAILED", "SUSPENDED")).toBe(false);
  });
});
