import { initGameState, setReady } from './test-hook';
import { connectSafe } from './net/room';
import { createRenderer, startRenderLoop } from './scene/renderer';

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

  (window as Window).__handleGroundClick__ = (clientX, clientY) =>
    game.handleClick({ clientX, clientY });

  window.addEventListener('resize', () => {
    game.camera.aspect = window.innerWidth / window.innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  await connectSafe();
  setReady(true);
}

boot();
