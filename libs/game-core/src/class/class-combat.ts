import { lookupStrBonus } from './stat-bonus';

export interface ClassCombatTemplate {
  basePAtk: number;
  baseStr: number;
}

export function calcClassBasePAtk(template: ClassCombatTemplate, level: number): number {
  const strBonus = lookupStrBonus(template.baseStr);
  return Math.floor(template.basePAtk * strBonus + level);
}
