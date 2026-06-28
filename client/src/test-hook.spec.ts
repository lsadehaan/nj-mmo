import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initGameState,
  setCharacterId,
  setMobs,
  setOthers,
  setPlayer,
  setTargetMobId,
  setAdena,
  setItems,
  setNpcs,
  setNearbyNpc,
  setShopOpen,
  setEquippedWeaponId,
  setMaxHp,
  setMaxMp,
} from './test-hook';

describe('test-hook multiplayer state', () => {
  beforeEach(() => {
    initGameState();
  });

  it('stores remote players in others', () => {
    const input = [
      { id: 'a', x: 1, y: 2, z: 3 },
      { id: 'b', x: 4, y: 5, z: 6 },
    ];
    setOthers(input);

    const state = window.__GAME_STATE__;
    expect(state.others).toEqual(input);
    expect(state.others).not.toBe(input);
  });

  it('stores characterId', () => {
    setCharacterId('char-uuid');
    expect(window.__GAME_STATE__.characterId).toBe('char-uuid');
    setCharacterId(null);
    expect(window.__GAME_STATE__.characterId).toBeNull();
  });

  it('starts with zero local movement ticks', () => {
    expect(window.__GAME_STATE__.localMovementTicks).toBe(0);
  });

  it('stores mobs from server snapshots without local hp mutation', () => {
    const input = [
      {
        id: 'mob-1',
        npcId: 20001,
        x: 12,
        y: 4.26,
        z: -18,
        hp: 41,
        maxHp: 41,
      },
    ];
    setMobs(input);

    const state = window.__GAME_STATE__;
    expect(state.mobs).toEqual(input);
    expect(state.mobs).not.toBe(input);
    input[0].hp = 0;
    expect(state.mobs[0].hp).toBe(41);
  });

  it('initializes animation clip to idle and updates from setPlayer', () => {
    expect(window.__GAME_STATE__.player.action).toBe('idle');
    setPlayer({
      x: 0,
      y: 0,
      z: 0,
      xp: 0,
      level: 1,
      hp: 100,
      mp: 50,
      powerStrikeCooldownEndMs: 0,
      action: 'attack',
    });
    expect(window.__GAME_STATE__.player.action).toBe('attack');
  });

  it('stores combat target and player progression from server', () => {
    setTargetMobId('mob-1');
    setPlayer({ x: 1, y: 2, z: 3, xp: 44, level: 1, hp: 100, mp: 50, powerStrikeCooldownEndMs: 0 });

    const state = window.__GAME_STATE__;
    expect(state.targetMobId).toBe('mob-1');
    expect(state.player.xp).toBe(44);
    expect(state.player.level).toBe(1);
  });

  it('initializes combat hook fields', () => {
    expect(window.__GAME_STATE__.mobs).toEqual([]);
    expect(window.__GAME_STATE__.targetMobId).toBeNull();
    expect(window.__GAME_STATE__.player.xp).toBe(0);
    expect(window.__GAME_STATE__.player.level).toBe(1);
  });

  it('initializes mp and Power Strike cooldown fields', () => {
    const { player } = window.__GAME_STATE__;
    expect(player.mp).toBe(0);
    expect(player.powerStrikeCooldownEndMs).toBe(0);
    expect(player.powerStrikeCooldownRemainingMs).toBe(0);
  });

  it('syncs player mp from server snapshots', () => {
    setPlayer({ x: 0, y: 0, z: 0, xp: 0, level: 1, hp: 100, mp: 41, powerStrikeCooldownEndMs: 0 });
    expect(window.__GAME_STATE__.player.mp).toBe(41);
  });

  it('syncs cooldown end and derives remaining ms from server timestamp', () => {
    const now = 10_000;
    setPlayer(
      { x: 0, y: 0, z: 0, xp: 0, level: 1, hp: 100, mp: 50, powerStrikeCooldownEndMs: 13_000 },
      now
    );
    const { player } = window.__GAME_STATE__;
    expect(player.powerStrikeCooldownEndMs).toBe(13_000);
    expect(player.powerStrikeCooldownRemainingMs).toBe(3_000);
  });

  it('reports zero remaining when cooldown has expired', () => {
    setPlayer(
      { x: 0, y: 0, z: 0, xp: 0, level: 1, hp: 100, mp: 50, powerStrikeCooldownEndMs: 5_000 },
      10_000
    );
    expect(window.__GAME_STATE__.player.powerStrikeCooldownRemainingMs).toBe(0);
  });
});

describe('test-hook town economy and NPC state', () => {
  beforeEach(() => {
    initGameState();
  });

  it('initializes adena to 0 until server sync (join contract expects 1000 from server)', () => {
    expect(window.__GAME_STATE__.adena).toBe(0);
    setAdena(1000);
    expect(window.__GAME_STATE__.adena).toBe(1000);
  });

  it('stores item counts from server snapshots without aliasing', () => {
    setItems({ 1060: 1, 1835: 2 });
    const state = window.__GAME_STATE__;
    expect(state.items).toEqual({ 1060: 1, 1835: 2 });
    state.items[1060] = 99;
    setItems({ 1060: 1, 1835: 2 });
    expect(window.__GAME_STATE__.items[1060]).toBe(1);
  });

  it('tracks npc list, proximity, and shop-open flags for e2e observers', () => {
    setNpcs([
      { npcId: 30004, name: 'Katerina', type: 'Merchant', x: -6, y: 4.26, z: -8 },
    ]);
    setNearbyNpc(30004, true);
    setShopOpen(true);

    const state = window.__GAME_STATE__;
    expect(state.npcs).toHaveLength(1);
    expect(state.nearbyNpcId).toBe(30004);
    expect(state.canInteract).toBe(true);
    expect(state.shopOpen).toBe(true);
  });

  it('exposes Playwright-callable commerce and NPC action hooks on window', () => {
    const calls: unknown[] = [];
    window.__interact__ = (npcId) => calls.push(['interact', npcId]);
    window.__buyItem__ = (npcId, itemId, quantity = 1) =>
      calls.push(['buy', npcId, itemId, quantity]);
    window.__sellItem__ = (npcId, itemId, quantity = 1) =>
      calls.push(['sell', npcId, itemId, quantity]);
    window.__npcAction__ = (npcId, action) => calls.push(['npcAction', npcId, action]);

    window.__interact__?.(30004);
    window.__buyItem__?.(30004, 1060);
    window.__sellItem__?.(30004, 1060);
    window.__npcAction__?.(30006, 'heal');

    expect(calls).toEqual([
      ['interact', 30004],
      ['buy', 30004, 1060, 1],
      ['sell', 30004, 1060, 1],
      ['npcAction', 30006, 'heal'],
    ]);
  });
});

describe('test-hook progression fields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    initGameState();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initializes equippedWeaponId, maxHp, and maxMp', () => {
    expect(window.__GAME_STATE__.equippedWeaponId).toBeNull();
    expect(window.__GAME_STATE__.maxHp).toBe(0);
    expect(window.__GAME_STATE__.maxMp).toBe(0);
  });

  it('setEquippedWeaponId mirrors server weapon slot (0 means none)', () => {
    setEquippedWeaponId(2369);
    expect(window.__GAME_STATE__.equippedWeaponId).toBe(2369);
    setEquippedWeaponId(null);
    expect(window.__GAME_STATE__.equippedWeaponId).toBeNull();
  });

  it('setMaxHp and setMaxMp update progression vitals on game state', () => {
    setMaxHp(112);
    setMaxMp(55);
    expect(window.__GAME_STATE__.maxHp).toBe(112);
    expect(window.__GAME_STATE__.maxMp).toBe(55);
  });

  it('syncs level 2 to HUD label after server player snapshot', () => {
    setMaxHp(112);
    setMaxMp(55);
    setPlayer({ x: 0, y: 0, z: 0, xp: 88, level: 2, hp: 112, mp: 55, powerStrikeCooldownEndMs: 0 });

    expect(window.__GAME_STATE__.player.level).toBe(2);
    const levelText = document.querySelector('#player-vitals-hud [data-role="level"]')?.textContent;
    expect(levelText).toBe('Lv.2');
    const hpText = document.querySelector('#player-vitals-hud [data-role="hp"]')?.textContent;
    expect(hpText).toBe('HP 112/112');
  });
});
