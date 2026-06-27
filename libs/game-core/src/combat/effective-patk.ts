export function effectivePAtk(
  basePAtk: number,
  equippedWeaponItemId: number | null | 0 | undefined,
  weaponPAtk: number | undefined
): number {
  if (!equippedWeaponItemId || weaponPAtk === undefined) {
    return basePAtk;
  }
  return basePAtk + weaponPAtk;
}
