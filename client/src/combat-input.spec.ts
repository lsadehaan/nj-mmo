import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initGameState, setMobs, setPlayer } from './test-hook';
import { wireCombatControls } from './combat-input';
import type { Room } from '@colyseus/sdk';
import type { GameRenderer } from './scene/renderer';

describe('combat input', () => {
  const send = vi.fn();
  const room = { send } as unknown as Room;
  const game = {
    setMoveIntentHandler: vi.fn(),
    setMobTargetHandler: vi.fn(),
    setVfxTargetMobId: vi.fn(),
  } as unknown as GameRenderer;

  beforeEach(() => {
    initGameState();
    send.mockReset();
    wireCombatControls(room, game);
  });

  it('sends useSkill for first known skill when key 2 pressed (SKILL20-47)', () => {
    setPlayer({
      x: 0,
      y: 0,
      z: 0,
      xp: 0,
      level: 1,
      hp: 100,
      mp: 50,
      knownSkillIds: [3, 1068],
      skillCooldownEndMs: [0, 0],
      powerStrikeCooldownEndMs: 0,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    expect(send).toHaveBeenCalledWith('useSkill', { skillId: 3 });
  });

  it('sends second known skill on key 3', () => {
    setPlayer({
      x: 0,
      y: 0,
      z: 0,
      xp: 0,
      level: 1,
      hp: 100,
      mp: 50,
      knownSkillIds: [3, 1177],
      skillCooldownEndMs: [0, 0],
      powerStrikeCooldownEndMs: 0,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    expect(send).toHaveBeenCalledWith('useSkill', { skillId: 1177 });
  });

  it('exposes __useSkill__ with explicit skillId without mutating local mob hp', () => {
    setMobs([
      {
        id: 'mob-1',
        npcId: 20001,
        x: 0,
        y: 0,
        z: 0,
        hp: 41,
        maxHp: 41,
        action: 'idle',
        actionSeq: 0,
      },
    ]);

    window.__useSkill__?.(29);
    expect(send).toHaveBeenCalledWith('useSkill', { skillId: 29 });
    expect(window.__GAME_STATE__.mobs[0].hp).toBe(41);
  });

  it('calls setVfxTargetMobId when mob is targeted', () => {
    window.__handleMobTarget__?.('mob-1');
    expect(game.setVfxTargetMobId).toHaveBeenCalledWith('mob-1');
    expect(send).toHaveBeenCalledWith('setTarget', { mobId: 'mob-1' });
  });
});
