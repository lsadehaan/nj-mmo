import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 750 } });
await p.goto(`http://localhost:4200/?room=hero-${Date.now()}`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__GAME_STATE__ && window.__GAME_STATE__.connected && window.__GAME_STATE__.maxHp > 0, { timeout: 30000 });
await p.waitForTimeout(3500); // GLB load

// Walk onto open ground, away from the village decoration at spawn.
await p.evaluate(() => window.__sendMoveIntent__?.(18, 14));
await p.waitForFunction(() => window.__GAME_STATE__.player.action === 'move', { timeout: 8000 }).catch(() => {});
await p.waitForTimeout(700);
await p.screenshot({ path: '/tmp/char-shots/hero-walk.png' });

// Arrive + idle.
for (let i = 0; i < 25; i++) {
  await p.waitForTimeout(250);
  const a = await p.evaluate(() => window.__GAME_STATE__.player.action);
  if (a === 'idle') break;
}
await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/char-shots/hero-idle.png' });
console.log('done, final action=', await p.evaluate(() => window.__GAME_STATE__.player.action));
await b.close();
