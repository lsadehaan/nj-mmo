import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initGameState, setMobs } from './test-hook';
import { wireCombatControls } from './combat-input';
import type { Room } from '@colyseus/sdk';
import type { GameRenderer } from './scene/renderer';

describe('combat input', () => {
  const send = vi.fn();
  const room = { send } as unknown as Room;
  const game = {
    setMoveIntentHandler: vi.fn(),
    setMobTargetHandler: vi.fn(),
  } as unknown as GameRenderer;

  beforeEach(() => {
    initGameState();
    send.mockReset();
    wireCombatControls(room, game);
  });

  it('sends useSkill intent when key 2 is pressed', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    expect(send).toHaveBeenCalledWith('useSkill', { skillId: 3 });
  });

  it('exposes __useSkill__ without mutating local mob hp', () => {
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
      },
    ]);

    window.__useSkill__?.();
    expect(send).toHaveBeenCalledWith('useSkill', { skillId: 3 });
    expect(window.__GAME_STATE__.mobs[0].hp).toBe(41);
  });
});
