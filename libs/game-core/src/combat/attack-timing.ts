const MIN_ATTACK_INTERVAL_MS = 50;
const ATTACK_SPEED_DIVISOR = 500_000;

export function calculateAttackIntervalMs(attackSpeed: number): number {
  return Math.max(MIN_ATTACK_INTERVAL_MS, Math.floor(ATTACK_SPEED_DIVISOR / attackSpeed));
}
