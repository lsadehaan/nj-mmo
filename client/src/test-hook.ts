export interface GameStatePlayer {
  x: number;
  y: number;
  z: number;
  xp: number;
  level: number;
  mp: number;
  powerStrikeCooldownEndMs: number;
  powerStrikeCooldownRemainingMs: number;
}

export interface GameStateMob {
  id: string;
  npcId: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
}

export interface OtherPlayer {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface GameState {
  connected: boolean;
  ready: boolean;
  player: GameStatePlayer;
  target: { x: number | null; z: number | null };
  others: OtherPlayer[];
  mobs: GameStateMob[];
  targetMobId: string | null;
  characterId: string | null;
  /** Stays 0 while movement is server-authoritative (no client step()). */
  localMovementTicks: number;
}

declare global {
  interface Window {
    __GAME_STATE__: GameState;
    __handleGroundClick__?: (clientX: number, clientY: number) => void;
    __handleMobTarget__?: (mobId: string) => void;
    __sendMoveIntent__?: (targetX: number, targetZ: number) => void;
    __attack__?: () => void;
    __useSkill__?: () => void;
    __consentLeave__?: () => Promise<void>;
  }
}

const initialState: GameState = {
  connected: false,
  ready: false,
  player: { x: 0, y: 0, z: 0, xp: 0, level: 1, mp: 0, powerStrikeCooldownEndMs: 0, powerStrikeCooldownRemainingMs: 0 },
  target: { x: null, z: null },
  others: [],
  mobs: [],
  targetMobId: null,
  characterId: null,
  localMovementTicks: 0,
};

export function initGameState(): GameState {
  window.__GAME_STATE__ = {
    ...initialState,
    player: { ...initialState.player },
    target: { ...initialState.target },
    others: [],
    mobs: [],
    targetMobId: null,
    characterId: null,
    localMovementTicks: 0,
  };
  return window.__GAME_STATE__;
}

export function getGameState(): GameState {
  if (!window.__GAME_STATE__) {
    return initGameState();
  }
  return window.__GAME_STATE__;
}

export function setConnected(connected: boolean): void {
  getGameState().connected = connected;
}

export function setReady(ready: boolean): void {
  getGameState().ready = ready;
}

export function setTarget(x: number | null, z: number | null): void {
  const state = getGameState();
  state.target.x = x;
  state.target.z = z;
}

export function computePowerStrikeCooldownRemainingMs(
  cooldownEndMs: number,
  nowMs = Date.now()
): number {
  return Math.max(0, cooldownEndMs - nowMs);
}

export function setPlayer(player: GameStatePlayer, nowMs = Date.now()): void {
  const state = getGameState();
  state.player.x = player.x;
  state.player.y = player.y;
  state.player.z = player.z;
  state.player.xp = player.xp;
  state.player.level = player.level;
  state.player.mp = player.mp;
  state.player.powerStrikeCooldownEndMs = player.powerStrikeCooldownEndMs;
  state.player.powerStrikeCooldownRemainingMs = computePowerStrikeCooldownRemainingMs(
    player.powerStrikeCooldownEndMs,
    nowMs
  );
}

export function setMobs(mobs: GameStateMob[]): void {
  getGameState().mobs = mobs.map((mob) => ({ ...mob }));
}

export function setTargetMobId(targetMobId: string | null): void {
  getGameState().targetMobId = targetMobId;
}

export function setOthers(others: OtherPlayer[]): void {
  getGameState().others = others.map((other) => ({ ...other }));
}

export function setCharacterId(characterId: string | null): void {
  getGameState().characterId = characterId;
}

export function recordLocalMovementTick(): void {
  getGameState().localMovementTicks += 1;
}
