import { initGameState, setReady } from './test-hook';
import { connectSafe } from './net/room';

async function boot(): Promise<void> {
  initGameState();
  await connectSafe();
  setReady(true);
}

boot();
