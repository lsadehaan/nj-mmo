import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { writeMobSpawnFixture } from '../src/seed/territory-spawns.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const xml = join(
  homedir(),
  'Dev/L2J_Mobius/L2J_Mobius_Classic_1.0/dist/game/data/spawns/TalkingIsland/TalkingIslandMonsters.xml'
);
const out = join(root, 'src/seed/__fixtures__/mob_spawns.json');
writeMobSpawnFixture(out, xml);
const rows = JSON.parse(readFileSync(out, 'utf-8')) as unknown[];
console.log(`Wrote ${rows.length} mob spawn rows`);
