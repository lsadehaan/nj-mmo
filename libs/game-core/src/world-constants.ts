import { snapEntityY, TERRAIN_SEED } from './terrain';

export { TERRAIN_SEED };

/** Axis-aligned world bounds (terrain size 200, 5-unit margin). */
export const WORLD_MIN = -95;
export const WORLD_MAX = 95;

export const SPAWN_X = 0;
export const SPAWN_Z = 0;

/** Derived from shared terrain height at spawn — not a magic float. */
export const SPAWN_Y = snapEntityY(SPAWN_X, SPAWN_Z);
