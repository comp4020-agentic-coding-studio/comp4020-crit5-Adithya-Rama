import type { HitBox, RunSnapshot } from "./types.ts";

export const RUN_DURATION_SECONDS = 210;
export const FINISH_SEQUENCE_SECONDS = 15;
export const NEAR_MISS_CLEARANCE = 0.45;
export const MAX_MULTIPLIER = 5;

export interface DifficultyProfile {
  progress: number;
  worldSpeed: number;
  spawnInterval: number;
  burstChance: number;
  truckChance: number;
  trafficCruiseMin: number;
  trafficCruiseMax: number;
  oncomingChance: number;
  oncomingSpeedMin: number;
  oncomingSpeedMax: number;
}

export type PassOutcome = "collision" | "near-miss" | "none";

export function boxesOverlap(a: HitBox, b: HitBox): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
    Math.abs(a.z - b.z) < (a.length + b.length) / 2
  );
}

export function boxesOverlapDuringStep(
  player: HitBox,
  vehicle: HitBox,
  previousVehicleZ: number,
): boolean {
  const travel = Math.abs(vehicle.z - previousVehicleZ);
  if (travel === 0) return boxesOverlap(player, vehicle);
  const sweptVehicle = {
    ...vehicle,
    z: (previousVehicleZ + vehicle.z) / 2,
    length: vehicle.length + travel,
  };
  return boxesOverlap(player, sweptVehicle);
}

export function lateralClearance(a: HitBox, b: HitBox): number {
  return Math.abs(a.x - b.x) - (a.width + b.width) / 2;
}

export function classifyPass(
  player: HitBox,
  vehicle: HitBox,
  hasPassed: boolean,
  alreadyScored: boolean,
  previousVehicleZ = vehicle.z,
): PassOutcome {
  if (boxesOverlapDuringStep(player, vehicle, previousVehicleZ))
    return "collision";
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

export function difficultyAt(elapsedSeconds: number): DifficultyProfile {
  const progress = Math.max(
    0,
    Math.min(1, elapsedSeconds / RUN_DURATION_SECONDS),
  );
  // A sub-linear curve makes the acceleration obvious early, then keeps
  // building pressure throughout the whole run without a sudden final spike.
  const eased = Math.pow(progress, 0.72);
  return {
    progress,
    worldSpeed: 28 + eased * 24,
    spawnInterval: 2.65 - eased * 1.67,
    burstChance: 0.08 + eased * 0.62,
    truckChance: 0.04 + eased * 0.31,
    trafficCruiseMin: 10 + eased * 3,
    trafficCruiseMax: 20 + eased * 5,
    oncomingChance:
      progress < 0.22
        ? 0
        : Math.pow((progress - 0.22) / 0.78, 1.15) * 0.48,
    oncomingSpeedMin: 20 + eased * 7,
    oncomingSpeedMax: 29 + eased * 11,
  };
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
