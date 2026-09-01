export type GameState = "playing" | "crashed" | "finished";

export type SteeringSource = "pointer" | "keyboard";

export interface SteeringSample {
  value: number;
  confidence: number;
  timestamp: number;
  source: SteeringSource;
}

export interface HitBox {
  x: number;
  z: number;
  width: number;
  length: number;
}

export interface RunSnapshot {
  state: GameState;
  elapsed: number;
  score: number;
  multiplier: number;
  lastNearMissAt: number;
}
