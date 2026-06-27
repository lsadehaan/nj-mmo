import { SPAWN_X, SPAWN_Y, SPAWN_Z } from './world-constants';

const NEWBIE_XP_PROTECTION_MAX_LEVEL = 9;

export interface PlayerDeathInput {
  level: number;
  xp: number;
  maxHp: number;
  maxMp: number;
}

export interface PlayerDeathResult {
  xp: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  mp: number;
}

export function resolvePlayerDeath(params: PlayerDeathInput): PlayerDeathResult {
  const xp =
    params.level <= NEWBIE_XP_PROTECTION_MAX_LEVEL ? params.xp : params.xp;

  return {
    xp,
    x: SPAWN_X,
    y: SPAWN_Y,
    z: SPAWN_Z,
    hp: params.maxHp,
    mp: params.maxMp,
  };
}
