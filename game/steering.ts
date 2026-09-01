export function shapeSteeringInput(
  value: number,
  deadZone = 0.07,
): number {
  const clamped = Math.max(-1, Math.min(1, value));
  const magnitude = Math.abs(clamped);
  if (magnitude <= deadZone) return 0;
  const normalized = (magnitude - deadZone) / (1 - deadZone);
  return Math.sign(clamped) * Math.pow(normalized, 1.35);
}

export function smoothSteering(
  current: number,
  target: number,
  deltaSeconds: number,
): number {
  const clampedTarget = Math.max(-1, Math.min(1, target));
  const difference = Math.abs(clampedTarget - current);
  const reversing =
    Math.abs(current) > 0.04 &&
    Math.abs(clampedTarget) > 0.04 &&
    Math.sign(current) !== Math.sign(clampedTarget);
  const responseRate =
    clampedTarget === 0 ? 5.2 : reversing ? 6.2 : 4.8 + difference * 2.2;
  const blend =
    1 - Math.exp(-Math.max(0, deltaSeconds) * responseRate);
  const next = current + (clampedTarget - current) * blend;
  return clampedTarget === 0 && Math.abs(next) < 0.002 ? 0 : next;
}
