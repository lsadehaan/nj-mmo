import { snapEntityY, TERRAIN_SEED, TERRAIN_CONFIG } from './terrain';

export { TERRAIN_SEED, TERRAIN_CONFIG };

/** Expanded TI world — 640 m terrain with 5 m margin. */
export const TERRAIN_SIZE = 640;
export const WORLD_MIN = -315;
export const WORLD_MAX = 315;

export const SPAWN_X = 0;
export const SPAWN_Z = 0;

/** Derived from shared terrain height at spawn — not a magic float. */
export const SPAWN_Y = snapEntityY(SPAWN_X, SPAWN_Z);
