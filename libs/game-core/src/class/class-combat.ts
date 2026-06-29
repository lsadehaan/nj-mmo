import { lookupStrBonus, lookupIntBonus } from './stat-bonus';

export interface ClassCombatTemplate {
  basePAtk: number;
  baseStr: number;
  baseMAtk?: number;
  baseInt?: number;
}

export function calcClassBasePAtk(template: ClassCombatTemplate, level: number): number {
  const strBonus = lookupStrBonus(template.baseStr);
  return Math.floor(template.basePAtk * strBonus + level);
}

export function calcClassBaseMAtk(template: ClassCombatTemplate, level: number): number {
  const baseMAtk = template.baseMAtk ?? 6;
  const baseInt = template.baseInt ?? 19;
  const intBonus = lookupIntBonus(baseInt);
  return Math.floor(baseMAtk * intBonus + level);
}
