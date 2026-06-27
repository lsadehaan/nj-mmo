import { initGameState, setReady, setTarget, setTargetMobId } from './test-hook';
import { connectSafe, wireRoom } from './net/room';
import { createRenderer, startRenderLoop } from './scene/renderer';
import type { Room } from '@colyseus/sdk';
import type { GameRenderer } from './scene/renderer';

function wireCombatControls(room: Room, game: GameRenderer): void {
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

  game.setMobTargetHandler(targetMob);

  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space' || ev.key === '1') {
      ev.preventDefault();
      attack();
    }
  });

  window.__handleMobTarget__ = targetMob;
  window.__sendMoveIntent__ = (targetX: number, targetZ: number) => {
    setTarget(targetX, targetZ);
    room.send('move', { targetX, targetZ });
  };
  window.__attack__ = attack;
}

async function boot(): Promise<void> {
  initGameState();

  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas #game not found');
  }

  const game = createRenderer(canvas);
  startRenderLoop(game);

  canvas.addEventListener('click', (ev) =>
    game.handleClick({ clientX: ev.clientX, clientY: ev.clientY })
  );

  window.__handleGroundClick__ = (clientX, clientY) =>
    game.handleClick({ clientX, clientY });

  window.addEventListener('resize', () => {
    game.camera.aspect = window.innerWidth / window.innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const room = await connectSafe();
  if (room) {
    wireCombatControls(room, game);
    wireRoom(room, game);
    window.__consentLeave__ = async () => {
      await room.leave(true);
    };
  } else {
    console.warn('Failed to connect to game server');
  }
  setReady(true);
}

boot();
