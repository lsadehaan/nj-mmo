/** Terrain seed shared with client renderer (WORLD_SEED). */
export const TERRAIN_SEED = 42;

/** Axis-aligned world bounds (terrain size 200, 5-unit margin). */
export const WORLD_MIN = -95;
export const WORLD_MAX = 95;

export const SPAWN_X = 0;
export const SPAWN_Z = 0;

/**
 * Matches client `sampleHeight(0, 0) + 1` for terrain seed 42, size 200,
 * segments 64, heightScale 10.
 */
export const SPAWN_Y = 4.263961466789237;
