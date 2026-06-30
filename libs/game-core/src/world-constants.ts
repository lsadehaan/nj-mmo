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

/**
 * Client renders mob meshes within this radius of the local player (m). Kept
 * below the AI wake distance: rendering/animating every mob the server keeps
 * awake (120 m) is the dominant client-side cost in dense fields, and an 80 m
 * field of visible mobs is already more than fills the camera frustum.
 */
export const MOB_RENDER_DISTANCE = 80;

/** Server runs mob AI only when a player is within this radius (m), or mob has aggro. */
export const MOB_AI_WAKE_DISTANCE = 120;
