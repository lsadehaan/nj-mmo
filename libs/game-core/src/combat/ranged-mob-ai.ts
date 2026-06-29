/** Whether a ranged mob should close distance to chase a target. */
export function shouldRangedMobAdvance(
  distance: number,
  attackRangeWorld: number,
  preferredAttackRangeWorld: number
): boolean {
  return distance > preferredAttackRangeWorld;
}

/** Whether horizontal distance is inside the ranged attack band (inclusive). */
export function isInRangedAttackBand(
  distance: number,
  attackRangeWorld: number,
  preferredAttackRangeWorld: number
): boolean {
  return distance >= attackRangeWorld && distance <= preferredAttackRangeWorld;
}
