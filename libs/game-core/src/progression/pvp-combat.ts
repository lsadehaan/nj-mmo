import { calcMeleeDamage } from '../combat/melee-damage';
import { canAttackPlayer } from './pvp-rules';
import type { SeededRng } from '../seeded-rng';

export interface PvpAttackParams {
  attacker: {
    pvpFlag: number;
    karma: number;
    pAtk: number;
    randomDamage?: number;
  };
  target: {
    pvpFlag: number;
    karma: number;
    pDef: number;
    alive: boolean;
  };
  zonePeace: boolean;
  rng?: SeededRng;
}

export interface PvpAttackResult {
  damage: number;
  allowed: boolean;
}

export function resolvePlayerVsPlayerAttack(params: PvpAttackParams): PvpAttackResult {
  const allowed = canAttackPlayer(
    { pvpFlag: params.attacker.pvpFlag, karma: params.attacker.karma },
    {
      pvpFlag: params.target.pvpFlag,
      karma: params.target.karma,
      alive: params.target.alive,
    },
    params.zonePeace
  );

  if (!allowed) {
    return { damage: 0, allowed: false };
  }

  const damage = calcMeleeDamage(
    { pAtk: params.attacker.pAtk, randomDamage: params.attacker.randomDamage ?? 0 },
    { pDef: params.target.pDef },
    { rng: params.rng, rngOffset: 0 }
  );

  return { damage, allowed: true };
}
