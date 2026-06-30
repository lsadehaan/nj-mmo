import { lookupConBonus } from '../class/stat-bonus';
import { enchantPAtkBonus, enchantPDefBonus } from './enchant';
import { calcArmorSetBonus } from './armor-sets';

export interface ClassPDefTemplate {
  baseCon: number;
}

/** Base pDef from class CON at level (Classic anchor pattern). */
export function calcClassBasePDef(template: ClassPDefTemplate, level: number): number {
  const conBonus = lookupConBonus(template.baseCon);
  return Math.floor(4 + conBonus * level);
}

export type ArmorPiece = {
  itemId: number;
  pDef: number;
  enchantLevel: number;
};

export function calcEffectivePAtk(
  basePAtk: number,
  weapon: { pAtk: number; weaponType?: string | null; bodyPart?: string | null } | null,
  enchantLevel: number
): number {
  if (!weapon) return basePAtk;
  const bonus = enchantPAtkBonus(weapon.weaponType, weapon.bodyPart, enchantLevel);
  return basePAtk + weapon.pAtk + bonus;
}

export function calcPlayerPDef(
  basePDef: number,
  armorPieces: ArmorPiece[],
  equippedItemIds: number[]
): { pDef: number; maxHpBonus: number } {
  let pDef = basePDef;
  for (const piece of armorPieces) {
    pDef += piece.pDef + enchantPDefBonus(piece.enchantLevel);
  }
  const setBonus = calcArmorSetBonus(equippedItemIds);
  pDef = Math.floor(pDef * (1 + setBonus.pDefPercentBonus));
  return { pDef, maxHpBonus: setBonus.maxHpBonus };
}
