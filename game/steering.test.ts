import { describe, expect, it } from "vitest";
import {
  median,
  normalisePalmRoll,
  smoothSteering,
  wrapDegrees,
} from "./steering.ts";

describe("palm steering", () => {
  it("calibrates from a stable median and keeps a neutral dead zone", () => {
    const neutral = median([2, 1, 40, 2, 3]);
    expect(neutral).toBe(2);
    expect(normalisePalmRoll(5, neutral)).toBe(0);
  });

  it("clamps steering and handles angle wraparound", () => {
    expect(wrapDegrees(358)).toBe(-2);
    expect(normalisePalmRoll(60, 0)).toBe(1);
    expect(normalisePalmRoll(-60, 0)).toBe(-1);
  });

  it("smoothly approaches the target without overshooting", () => {
    const next = smoothSteering(0, 1, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
  });
});
