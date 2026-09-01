const MAX_ROLL_DEGREES = 32;
const DEAD_ZONE_DEGREES = 3;
const RESPONSE_EXPONENT = 1.22;

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

export function circularMeanDegrees(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sine = 0;
  let cosine = 0;
  for (const value of values) {
    const radians = (value * Math.PI) / 180;
    sine += Math.sin(radians);
    cosine += Math.cos(radians);
  }
  return wrapDegrees((Math.atan2(sine, cosine) * 180) / Math.PI);
}

export function angularSpreadDegrees(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const centre = circularMeanDegrees(values);
  return Math.max(
    ...values.map((value) => Math.abs(wrapDegrees(value - centre))),
  );
}

export function normalisePalmRoll(
  measuredDegrees: number,
  neutralDegrees: number,
): number {
  const delta = wrapDegrees(measuredDegrees - neutralDegrees);
  if (Math.abs(delta) <= DEAD_ZONE_DEGREES) return 0;
  const linear =
    (Math.abs(delta) - DEAD_ZONE_DEGREES) /
    (MAX_ROLL_DEGREES - DEAD_ZONE_DEGREES);
  const curved = Math.pow(
    Math.max(0, Math.min(1, linear)),
    RESPONSE_EXPONENT,
  );
  return Math.sign(delta) * curved;
}

export function smoothSteering(
  current: number,
  target: number,
  deltaSeconds: number,
): number {
  const difference = Math.abs(target - current);
  const responseRate = 6.5 + difference * 9;
  const blend = 1 - Math.exp(-Math.max(0, deltaSeconds) * responseRate);
  return current + (target - current) * blend;
}
