import { initGameState, setReady, getGameState } from './test-hook';
import { connectSafe, wireRoom } from './net/room';
import { wireCombatControls } from './combat-input';
import { mountPowerStrikeCooldown, startPowerStrikeCooldownLoop } from './hud/power-strike-cooldown';
import { mountPlayerVitalsHud } from './hud/player-vitals';
import { mountShopWindow } from './ui/shop-window';
import { mountInventoryWindow } from './ui/inventory-window';
import { mountNpcDialog } from './ui/npc-dialog';
import { mountInteractPrompt } from './npc-interaction';
import { createRenderer, startRenderLoop } from './scene/renderer';

async function boot(): Promise<void> {
  initGameState();
  mountPowerStrikeCooldown();
  mountPlayerVitalsHud();
  mountShopWindow();
  mountInventoryWindow();
  mountNpcDialog();
  mountInteractPrompt();
  startPowerStrikeCooldownLoop(() => getGameState().player.powerStrikeCooldownEndMs);

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
