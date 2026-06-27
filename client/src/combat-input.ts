import { setTarget, setTargetMobId } from './test-hook';
import type { Room } from '@colyseus/sdk';
import type { GameRenderer } from './scene/renderer';

export function wireCombatControls(room: Room, game: GameRenderer): void {
  game.setMoveIntentHandler((intent) => {
    room.send('move', { targetX: intent.targetX, targetZ: intent.targetZ });
  });

  const targetMob = (mobId: string): void => {
    setTargetMobId(mobId);
    room.send('setTarget', { mobId });
  };

  const attack = (): void => {
    room.send('attack');
  };

  const useSkill = (): void => {
    room.send('useSkill', { skillId: 3 });
  };

  game.setMobTargetHandler(targetMob);

  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space' || ev.key === '1') {
      ev.preventDefault();
      attack();
    }
    if (ev.key === '2') {
      ev.preventDefault();
      useSkill();
    }
  });

  window.__handleMobTarget__ = targetMob;
  window.__sendMoveIntent__ = (targetX: number, targetZ: number) => {
    setTarget(targetX, targetZ);
    room.send('move', { targetX, targetZ });
  };
  window.__attack__ = attack;
  window.__useSkill__ = useSkill;
}
