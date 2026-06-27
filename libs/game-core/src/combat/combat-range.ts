export function horizontalDistance(
  x1: number,
  z1: number,
  x2: number,
  z2: number
): number {
  return Math.hypot(x2 - x1, z2 - z1);
}

export function isInMeleeRange(
  ax: number,
  az: number,
  tx: number,
  tz: number,
  rangeWorld: number
): boolean {
  return horizontalDistance(ax, az, tx, tz) <= rangeWorld;
}
