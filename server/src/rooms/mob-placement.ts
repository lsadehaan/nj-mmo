import type { MobRuntime } from './spawn-manager';
import { syncMobState } from './spawn-manager';
import type { MobState } from './schema/MobState';

/** Pin mob wander at current position (same semantics as room-test `relocateMob`). */
export function freezeMobWander(runtime: MobRuntime): void {
  runtime.wanderTargetX = runtime.x;
  runtime.wanderTargetZ = runtime.z;
  runtime.wanderCooldownMs = Number.MAX_SAFE_INTEGER;
}

export function applyMobPosition(
  runtime: MobRuntime,
  mobState: MobState,
  x: number,
  z: number
): void {
  runtime.x = x;
  runtime.z = z;
  runtime.wanderTargetX = x;
  runtime.wanderTargetZ = z;
  runtime.wanderCooldownMs = Number.MAX_SAFE_INTEGER;
  syncMobState(mobState, runtime);
}
