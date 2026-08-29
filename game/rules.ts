import type { HitBox, RunSnapshot } from "./types.ts";

export const RUN_DURATION_SECONDS = 150;
export const NEAR_MISS_CLEARANCE = 0.45;
export const MAX_MULTIPLIER = 5;

export type PassOutcome = "collision" | "near-miss" | "none";

export function boxesOverlap(a: HitBox, b: HitBox): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
    Math.abs(a.z - b.z) < (a.length + b.length) / 2
  );
}

export function lateralClearance(a: HitBox, b: HitBox): number {
  return Math.abs(a.x - b.x) - (a.width + b.width) / 2;
}

export function classifyPass(
  player: HitBox,
  vehicle: HitBox,
  hasPassed: boolean,
  alreadyScored: boolean,
): PassOutcome {
  if (boxesOverlap(player, vehicle)) return "collision";
  const clearance = lateralClearance(player, vehicle);
  if (
    hasPassed &&
    !alreadyScored &&
    clearance >= 0 &&
    clearance <= NEAR_MISS_CLEARANCE
  ) {
    return "near-miss";
  }
  return "none";
}

export function initialRun(): RunSnapshot {
  return {
    state: "playing",
    elapsed: 0,
    score: 0,
    multiplier: 1,
    lastNearMissAt: Number.NEGATIVE_INFINITY,
  };
}

export function applyNearMiss(run: RunSnapshot): RunSnapshot {
  if (run.state !== "playing") return run;
  return {
    ...run,
    score: run.score + Math.round(250 * run.multiplier),
    multiplier: Math.min(MAX_MULTIPLIER, run.multiplier + 0.5),
    lastNearMissAt: run.elapsed,
  };
}

export function crashRun(run: RunSnapshot): RunSnapshot {
  return run.state === "playing" ? { ...run, state: "crashed" } : run;
}

export function advanceRun(
  run: RunSnapshot,
  deltaSeconds: number,
  speed: number,
): RunSnapshot {
  if (run.state !== "playing") return run;

  const elapsed = Math.min(
    RUN_DURATION_SECONDS,
    run.elapsed + Math.max(0, deltaSeconds),
  );
  const multiplier =
    elapsed - run.lastNearMissAt > 4
      ? Math.max(1, run.multiplier - deltaSeconds * 0.28)
      : run.multiplier;

  return {
    ...run,
    state: elapsed >= RUN_DURATION_SECONDS ? "finished" : "playing",
    elapsed,
    multiplier,
    score: run.score + Math.max(0, speed) * deltaSeconds * multiplier,
  };
}
