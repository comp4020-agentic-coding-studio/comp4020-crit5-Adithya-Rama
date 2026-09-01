import { describe, expect, it } from "vitest";
import {
  angularSpreadDegrees,
  circularMeanDegrees,
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

  it("averages across the angle boundary without a false steering jump", () => {
    const mean = circularMeanDegrees([178, 179, -179, -178]);
    expect(Math.abs(mean)).toBeGreaterThan(178);
    expect(angularSpreadDegrees([178, 179, -179, -178])).toBeLessThan(3);
  });

  it("damps small tremors while preserving decisive full steering", () => {
    expect(Math.abs(normalisePalmRoll(7, 0))).toBeLessThan(0.1);
    expect(normalisePalmRoll(40, 0)).toBe(1);
    expect(normalisePalmRoll(-40, 0)).toBe(-1);
  });

  it("clamps steering and handles angle wraparound", () => {
    expect(wrapDegrees(358)).toBe(-2);
    expect(normalisePalmRoll(60, 0)).toBe(1);
    expect(normalisePalmRoll(-60, 0)).toBe(-1);
  });

  it("smoothly approaches the target without overshooting", () => {
    const small = smoothSteering(0, 0.08, 1 / 60);
    const decisive = smoothSteering(0, 1, 1 / 60);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(0.08);
    expect(decisive).toBeGreaterThan(small);
    expect(decisive).toBeLessThan(1);
  });
});
