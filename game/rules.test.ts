import { describe, expect, it } from "vitest";
import {
  RUN_DURATION_SECONDS,
  advanceRun,
  applyNearMiss,
  classifyPass,
  crashRun,
  difficultyAt,
  initialRun,
} from "./rules.ts";

const player = { x: 0, z: 0, width: 1, length: 2 };

describe("HANDSHIFT rules", () => {
  it("ends the run when the player collides with traffic", () => {
    const vehicle = { x: 0.4, z: 0.5, width: 1.8, length: 4 };
    expect(classifyPass(player, vehicle, false, false)).toBe("collision");
    expect(crashRun(initialRun()).state).toBe("crashed");
  });

  it("awards a near miss only after a non-colliding pass and only once", () => {
    const vehicle = { x: 1.55, z: 3, width: 1.2, length: 3 };
    expect(classifyPass(player, vehicle, false, false)).toBe("none");
    expect(classifyPass(player, vehicle, true, false)).toBe("near-miss");
    expect(classifyPass(player, vehicle, true, true)).toBe("none");

    const rewarded = applyNearMiss(initialRun());
    expect(rewarded.score).toBe(250);
    expect(rewarded.multiplier).toBe(1.5);
  });

  it("increases speed, traffic frequency and truck pressure over time", () => {
    const opening = difficultyAt(0);
    const middle = difficultyAt(RUN_DURATION_SECONDS / 2);
    const finale = difficultyAt(RUN_DURATION_SECONDS);

    expect(middle.worldSpeed).toBeGreaterThan(opening.worldSpeed);
    expect(finale.worldSpeed).toBeGreaterThan(middle.worldSpeed);
    expect(middle.spawnInterval).toBeLessThan(opening.spawnInterval);
    expect(finale.spawnInterval).toBeLessThan(middle.spawnInterval);
    expect(finale.truckChance).toBeGreaterThan(opening.truckChance);
  });

  it("finishes a surviving run at 210 seconds", () => {
    const run = advanceRun(
      { ...initialRun(), elapsed: RUN_DURATION_SECONDS - 0.1 },
      0.1,
      10,
    );
    expect(run.state).toBe("finished");
    expect(run.elapsed).toBe(RUN_DURATION_SECONDS);
  });
});
