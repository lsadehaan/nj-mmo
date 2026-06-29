export type EffectKind = 'buff_self' | 'debuff_enemy';

export interface ActiveEffect {
  kind: EffectKind;
  skillId: number;
  multiplier: number;
  expiresAtMs: number;
}

export interface EffectTarget {
  activeEffect: ActiveEffect | null;
}

export function applyBuffSelf(
  target: EffectTarget,
  skillId: number,
  multiplier: number,
  durationSec: number,
  nowMs: number
): void {
  target.activeEffect = {
    kind: 'buff_self',
    skillId,
    multiplier,
    expiresAtMs: nowMs + durationSec * 1000,
  };
}

export function applyDebuffEnemy(
  target: EffectTarget,
  skillId: number,
  multiplier: number,
  durationSec: number,
  nowMs: number
): void {
  target.activeEffect = {
    kind: 'debuff_enemy',
    skillId,
    multiplier,
    expiresAtMs: nowMs + durationSec * 1000,
  };
}

export function tickActiveEffects(target: EffectTarget, nowMs: number): void {
  if (target.activeEffect && target.activeEffect.expiresAtMs <= nowMs) {
    target.activeEffect = null;
  }
}

export function getPatkMultiplier(target: EffectTarget): number {
  const fx = target.activeEffect;
  if (!fx) return 1;
  if (fx.kind === 'buff_self') return fx.multiplier;
  if (fx.kind === 'debuff_enemy') return fx.multiplier;
  return 1;
}
