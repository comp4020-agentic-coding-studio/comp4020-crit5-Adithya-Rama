const MAX_ROLL_DEGREES = 35;
const DEAD_ZONE_DEGREES = 4;

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

export function wrapDegrees(angle: number): number {
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

export function normalisePalmRoll(
  measuredDegrees: number,
  neutralDegrees: number,
): number {
  const delta = wrapDegrees(measuredDegrees - neutralDegrees);
  if (Math.abs(delta) <= DEAD_ZONE_DEGREES) return 0;
  const directed = delta - Math.sign(delta) * DEAD_ZONE_DEGREES;
  return Math.max(
    -1,
    Math.min(1, directed / (MAX_ROLL_DEGREES - DEAD_ZONE_DEGREES)),
  );
}

export function smoothSteering(
  current: number,
  target: number,
  deltaSeconds: number,
): number {
  const blend = 1 - Math.exp(-Math.max(0, deltaSeconds) * 10);
  return current + (target - current) * blend;
}
