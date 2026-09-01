import { describe, expect, it } from "vitest";
import {
  shapeSteeringInput,
  smoothSteering,
} from "./steering.ts";

describe("steering response", () => {
  it("keeps tiny pointer movement inside a stable centre dead zone", () => {
    expect(shapeSteeringInput(0.05)).toBe(0);
    expect(shapeSteeringInput(-0.05)).toBe(0);
  });

  it("gives pointer movement finer control near centre", () => {
    const correction = shapeSteeringInput(0.5);
    expect(correction).toBeGreaterThan(0.25);
    expect(correction).toBeLessThan(0.5);
    expect(shapeSteeringInput(-0.5)).toBeCloseTo(-correction);
    expect(shapeSteeringInput(1)).toBe(1);
  });

  it("does not move when no time has elapsed", () => {
    expect(smoothSteering(0.35, -1, 0)).toBe(0.35);
  });

  it("moves toward the target without overshooting", () => {
    const next = smoothSteering(0, 1, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
  });

  it("changes direction progressively rather than snapping", () => {
    const firstFrame = smoothSteering(1, -1, 1 / 60);
    expect(firstFrame).toBeGreaterThan(0.7);
    const afterRelease = smoothSteering(0.5, 0, 1 / 60);
    expect(afterRelease).toBeGreaterThan(0);
    expect(afterRelease).toBeLessThan(0.5);
  });
});
