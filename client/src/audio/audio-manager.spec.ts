import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntityAction } from '@nj/game-core';
import { createMockAudioBackend, isOneShotCall, isLoopCall, isStopCall } from './audio-backend';
import { createAudioManager, CROSSFADE_MS, AMBIENT_GAIN_FACTOR } from './audio-manager';

const basePlayer = {
  hp: 100,
  level: 1,
  action: EntityAction.None,
  actionSeq: 0,
  x: 0,
  y: 0,
  z: 0,
};

describe('audio-manager zone and ambient', () => {
  let calls: ReturnType<typeof createMockAudioBackend>['calls'];
  let mgr: ReturnType<typeof createAudioManager>;

  beforeEach(() => {
    const mock = createMockAudioBackend();
    calls = mock.calls;
    mgr = createAudioManager({ backend: mock.backend });
  });

  it('AUD29-13: zone change crossfades music over 1500ms', () => {
    mgr.syncZone('ti_village');
    mgr.syncZone('eastern_fields');
    const stops = calls.filter((c): c is Extract<typeof c, { kind: 'stop' }> =>
      isStopCall(c) && c.id === 'music_town'
    );
    expect(stops[0]?.fadeMs).toBe(CROSSFADE_MS);
    const fieldLoop = calls.find(
      (c): c is Extract<typeof c, { kind: 'loop' }> =>
        isLoopCall(c) && c.id === 'music_field'
    );
    expect(fieldLoop?.fadeMs).toBe(CROSSFADE_MS);
  });

  it('AUD29-14: duplicate syncZone does not restart current music', () => {
    mgr.syncZone('ti_village');
    const afterFirst = calls.filter((c) => c.kind === 'loop' && c.id === 'music_town').length;
    mgr.syncZone('ti_village');
    const afterSecond = calls.filter((c) => c.kind === 'loop' && c.id === 'music_town').length;
    expect(afterSecond).toBe(afterFirst);
  });

  it('AUD29-38: zone change stops prior ambient before new one', () => {
    mgr.syncZone('ti_village');
    mgr.syncZone('harbor');
    expect(calls.some((c) => c.kind === 'stop' && c.id === 'ambient_village')).toBe(true);
    expect(calls.some((c) => c.kind === 'loop' && c.id === 'ambient_waves')).toBe(true);
  });

  it('AUD29-39: ambient volume capped at 0.35 × sfxVolume', () => {
    mgr.setSfxVolume(0.8);
    mgr.syncZone('ti_village');
    const ambient = calls.find(
      (c): c is Extract<typeof c, { kind: 'loop' }> =>
        isLoopCall(c) && c.id === 'ambient_village'
    );
    expect(ambient?.volume).toBeCloseTo(0.8 * AMBIENT_GAIN_FACTOR, 2);
  });
});

describe('audio-manager combat sfx', () => {
  let calls: ReturnType<typeof createMockAudioBackend>['calls'];
  let mgr: ReturnType<typeof createAudioManager>;

  beforeEach(() => {
    const mock = createMockAudioBackend();
    calls = mock.calls;
    mgr = createAudioManager({ backend: mock.backend });
  });

  it('AUD29-17: mob hp decrease plays sfx_melee_hit', () => {
    mgr.syncMob({ id: 'm1', hp: 50 });
    mgr.syncMob({ id: 'm1', hp: 40 });
    expect(calls.filter((c) => c.kind === 'oneShot' && c.id === 'sfx_melee_hit')).toHaveLength(1);
  });

  it('AUD29-18: player hp decrease plays sfx_melee_hit', () => {
    mgr.syncPlayer({ ...basePlayer, hp: 100 });
    mgr.syncPlayer({ ...basePlayer, hp: 90 });
    expect(calls.filter((c) => c.kind === 'oneShot' && c.id === 'sfx_melee_hit')).toHaveLength(1);
  });

  it('AUD29-19: cast actionSeq bump plays sfx_skill_cast', () => {
    mgr.syncPlayer({ ...basePlayer });
    mgr.syncPlayer({ ...basePlayer, action: EntityAction.Cast, actionSeq: 1 });
    expect(calls.some((c) => isOneShotCall(c) && c.id === 'sfx_skill_cast')).toBe(true);
  });

  it('AUD29-20: attack actionSeq bump plays sfx_melee_swing', () => {
    mgr.syncPlayer({ ...basePlayer });
    mgr.syncPlayer({ ...basePlayer, action: EntityAction.Attack, actionSeq: 1 });
    expect(calls.some((c) => isOneShotCall(c) && c.id === 'sfx_melee_swing')).toBe(true);
  });

  it('AUD29-21: level up plays sfx_level_up per level gained', () => {
    mgr.syncPlayer({ ...basePlayer, level: 1 });
    mgr.syncPlayer({ ...basePlayer, level: 3 });
    expect(calls.filter((c) => isOneShotCall(c) && c.id === 'sfx_level_up')).toHaveLength(2);
  });

  it('AUD29-22: combat stinger on null to mob target', () => {
    mgr.syncCombat(null);
    mgr.syncCombat('mob-a');
    expect(calls.filter((c) => isOneShotCall(c) && c.id === 'sfx_combat_stinger')).toHaveLength(1);
  });

  it('AUD29-23: retarget without clear does not replay stinger', () => {
    mgr.syncCombat(null);
    mgr.syncCombat('mob-a');
    mgr.syncCombat('mob-b');
    expect(calls.filter((c) => isOneShotCall(c) && c.id === 'sfx_combat_stinger')).toHaveLength(1);
  });

  it('AUD29-24: melee hit throttled within 80ms', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000);
      mgr.syncMob({ id: 'm1', hp: 50 });
      mgr.syncMob({ id: 'm1', hp: 40 });
      vi.setSystemTime(1050);
      mgr.syncMob({ id: 'm1', hp: 30 });
      expect(calls.filter((c) => isOneShotCall(c) && c.id === 'sfx_melee_hit')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('AUD29-25: NaN position skips combat sfx', () => {
    mgr.syncPlayer({ ...basePlayer, hp: 100 });
    mgr.syncPlayer({ ...basePlayer, hp: 50, x: Number.NaN });
    expect(calls.filter((c) => c.kind === 'oneShot')).toHaveLength(0);
  });

  it('AUD29-26: soulshot plays on attack edge with soulshotCount', () => {
    mgr.syncPlayer({ ...basePlayer, soulshotCount: 5 });
    mgr.syncPlayer({
      ...basePlayer,
      soulshotCount: 5,
      action: EntityAction.Attack,
      actionSeq: 1,
    });
    expect(calls.some((c) => isOneShotCall(c) && c.id === 'sfx_soulshot')).toBe(true);
    expect(calls.some((c) => isOneShotCall(c) && c.id === 'sfx_melee_swing')).toBe(true);
  });
});

describe('audio-manager footsteps', () => {
  it('AUD29-40: footstep plays after distance threshold', () => {
    const mock = createMockAudioBackend();
    const mgr = createAudioManager({ backend: mock.backend });
    mgr.tickFootsteps({ x: 0, z: 0, zoneType: 'peace' }, 0);
    mgr.tickFootsteps({ x: 1, z: 0, zoneType: 'peace' }, 400);
    expect(mock.calls.some((c) => isOneShotCall(c) && c.id === 'sfx_footstep')).toBe(true);
  });

  it('AUD29-41: footstep throttled within 350ms', () => {
    const mock = createMockAudioBackend();
    const mgr = createAudioManager({ backend: mock.backend });
    mgr.tickFootsteps({ x: 0, z: 0, zoneType: 'peace' }, 0);
    mgr.tickFootsteps({ x: 1, z: 0, zoneType: 'peace' }, 400);
    mgr.tickFootsteps({ x: 2, z: 0, zoneType: 'peace' }, 500);
    expect(mock.calls.filter((c) => isOneShotCall(c) && c.id === 'sfx_footstep')).toHaveLength(1);
  });
});
