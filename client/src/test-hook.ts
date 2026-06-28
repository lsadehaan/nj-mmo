import { updatePowerStrikeCooldown } from './hud/power-strike-cooldown';
import { updatePlayerVitalsHud } from './hud/player-vitals';
import type { AnimationClip } from '@nj/game-core';

export interface GameStateVfx {
  powerStrikeCount: number;
  meleeHitCount: number;
  levelUpCount: number;
  targetRingVisible: boolean;
  activeEffectCount: number;
}

export interface GameStatePlayer {
  x: number;
  y: number;
  z: number;
  xp: number;
  level: number;
  hp: number;
  mp: number;
  powerStrikeCooldownEndMs: number;
  powerStrikeCooldownRemainingMs: number;
  action: AnimationClip;
}

/** Server snapshot input — remaining cooldown is derived client-side. */
export type GameStatePlayerInput = Omit<
  GameStatePlayer,
  'powerStrikeCooldownRemainingMs' | 'action'
> & {
  action?: AnimationClip;
};

export interface GameStateMob {
  id: string;
  npcId: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  action: AnimationClip;
}

export interface OtherPlayer {
  id: string;
  x: number;
  y: number;
  z: number;
  renderKind: 'mesh';
  action: AnimationClip;
  equippedWeaponId: number | null;
}

export interface GameStateNpc {
  npcId: number;
  name: string;
  type: string;
  x: number;
  y: number;
  z: number;
  renderKind?: 'mesh' | 'capsule';
  action?: AnimationClip;
}

export interface GameState {
  connected: boolean;
  ready: boolean;
  player: GameStatePlayer;
  target: { x: number | null; z: number | null };
  others: OtherPlayer[];
  mobs: GameStateMob[];
  npcs: GameStateNpc[];
  adena: number;
  items: Record<number, number>;
  nearbyNpcId: number | null;
  canInteract: boolean;
  shopOpen: boolean;
  targetMobId: string | null;
  characterId: string | null;
  equippedWeaponId: number | null;
  maxHp: number;
  maxMp: number;
  /** Stays 0 while movement is server-authoritative (no client step()). */
  localMovementTicks: number;
  vfx: GameStateVfx;
}

declare global {
  interface Window {
    __GAME_STATE__: GameState;
    __handleGroundClick__?: (clientX: number, clientY: number) => void;
    __handleMobTarget__?: (mobId: string) => void;
    __sendMoveIntent__?: (targetX: number, targetZ: number) => void;
    __attack__?: () => void;
    __useSkill__?: () => void;
    __interact__?: (npcId: number) => void;
    __buyItem__?: (npcId: number, itemId: number, quantity?: number) => void;
    __sellItem__?: (npcId: number, itemId: number, quantity?: number) => void;
    __npcAction__?: (npcId: number, action: 'heal' | 'starterKit') => void;
    __equipItem__?: (itemId: number) => void;
    __openInventory__?: () => void;
    __consentLeave__?: () => Promise<void>;
  }
}

const initialState: GameState = {
  connected: false,
  ready: false,
  player: { x: 0, y: 0, z: 0, xp: 0, level: 1, hp: 0, mp: 0, powerStrikeCooldownEndMs: 0, powerStrikeCooldownRemainingMs: 0, action: 'idle' },
  target: { x: null, z: null },
  others: [],
  mobs: [],
  npcs: [],
  adena: 0,
  items: {},
  nearbyNpcId: null,
  canInteract: false,
  shopOpen: false,
  targetMobId: null,
  characterId: null,
  equippedWeaponId: null,
  maxHp: 0,
  maxMp: 0,
  localMovementTicks: 0,
  vfx: {
    powerStrikeCount: 0,
    meleeHitCount: 0,
    levelUpCount: 0,
    targetRingVisible: false,
    activeEffectCount: 0,
  },
};

export function initGameState(): GameState {
  window.__GAME_STATE__ = {
    ...initialState,
    player: { ...initialState.player },
    target: { ...initialState.target },
    others: [],
    mobs: [],
    npcs: [],
    adena: 0,
    items: {},
    nearbyNpcId: null,
    canInteract: false,
    shopOpen: false,
    targetMobId: null,
    characterId: null,
    equippedWeaponId: null,
    maxHp: 0,
    maxMp: 0,
    localMovementTicks: 0,
    vfx: {
      powerStrikeCount: 0,
      meleeHitCount: 0,
      levelUpCount: 0,
      targetRingVisible: false,
      activeEffectCount: 0,
    },
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

export function setPlayer(player: GameStatePlayerInput, nowMs = Date.now()): void {
  const state = getGameState();
  state.player.x = player.x;
  state.player.y = player.y;
  state.player.z = player.z;
  state.player.xp = player.xp;
  state.player.level = player.level;
  state.player.hp = player.hp;
  state.player.mp = player.mp;
  state.player.powerStrikeCooldownEndMs = player.powerStrikeCooldownEndMs;
  state.player.powerStrikeCooldownRemainingMs = computePowerStrikeCooldownRemainingMs(
    player.powerStrikeCooldownEndMs,
    nowMs
  );
  if (player.action !== undefined) {
    state.player.action = player.action;
  }
  if (typeof document !== 'undefined') {
    updatePowerStrikeCooldown(player.powerStrikeCooldownEndMs, nowMs);
    updatePlayerVitalsHud({
      level: player.level,
      hp: player.hp,
      maxHp: state.maxHp,
      mp: player.mp,
      maxMp: state.maxMp,
    });
  }
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

export function setAdena(adena: number): void {
  getGameState().adena = adena;
}

export function setItems(items: Record<number, number>): void {
  getGameState().items = { ...items };
}

export function setNpcs(npcs: GameStateNpc[]): void {
  getGameState().npcs = npcs.map((npc) => ({ ...npc }));
}

export function setNearbyNpc(nearbyNpcId: number | null, canInteract: boolean): void {
  const state = getGameState();
  state.nearbyNpcId = nearbyNpcId;
  state.canInteract = canInteract;
}

export function setShopOpen(shopOpen: boolean): void {
  getGameState().shopOpen = shopOpen;
}

export function setEquippedWeaponId(equippedWeaponId: number | null): void {
  getGameState().equippedWeaponId = equippedWeaponId;
}

export function setMaxHp(maxHp: number): void {
  const state = getGameState();
  state.maxHp = maxHp;
  if (typeof document !== 'undefined') {
    updatePlayerVitalsHud({
      level: state.player.level,
      hp: state.player.hp,
      maxHp,
      mp: state.player.mp,
      maxMp: state.maxMp,
    });
  }
}

export function setMaxMp(maxMp: number): void {
  const state = getGameState();
  state.maxMp = maxMp;
  if (typeof document !== 'undefined') {
    updatePlayerVitalsHud({
      level: state.player.level,
      hp: state.player.hp,
      maxHp: state.maxHp,
      mp: state.player.mp,
      maxMp,
    });
  }
}
