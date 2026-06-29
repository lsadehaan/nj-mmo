import { setTarget, setTargetMobId, getGameState } from './test-hook';
import type { Room } from '@colyseus/sdk';
import type { GameRenderer } from './scene/renderer';
import { getHotbarHotkeys } from './ui/hotbar';

export function wireCombatControls(room: Room, game: GameRenderer): void {
  game.setMoveIntentHandler((intent) => {
    room.send('move', { targetX: intent.targetX, targetZ: intent.targetZ });
  });

  const targetMob = (mobId: string): void => {
    setTargetMobId(mobId);
    game.setVfxTargetMobId(mobId);
    room.send('setTarget', { mobId });
  };

  const attack = (): void => {
    room.send('attack');
  };

  const useSkill = (skillId: number): void => {
    room.send('useSkill', { skillId });
  };

  game.setMobTargetHandler(targetMob);

  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space' || ev.key === '1') {
      ev.preventDefault();
      attack();
    }
    const hotkeys = getHotbarHotkeys();
    const idx = hotkeys.indexOf(ev.key as (typeof hotkeys)[number]);
    if (idx >= 0) {
      const skillId = getGameState().player.knownSkillIds[idx];
      if (skillId) {
        ev.preventDefault();
        useSkill(skillId);
      }
    }
  });

  window.__handleMobTarget__ = targetMob;
  window.__sendMoveIntent__ = (targetX: number, targetZ: number) => {
    setTarget(targetX, targetZ);
    room.send('move', { targetX, targetZ });
  };
  window.__attack__ = attack;
  window.__useSkill__ = (skillId = 3) => useSkill(skillId);
}
