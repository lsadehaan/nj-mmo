import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { writeNpcSpawnFixture } from '../src/seed/npc-spawn-fixture.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gludio = join(
  homedir(),
  'Dev/L2J_Mobius/L2J_Mobius_Classic_1.0/dist/game/data/spawns/Gludio/Gludio.xml'
);
const out = join(root, 'src/seed/__fixtures__/npc_spawns.json');
writeNpcSpawnFixture(out, gludio);
const rows = JSON.parse(readFileSync(out, 'utf-8')) as unknown[];
console.log(`Wrote ${rows.length} NPC spawn rows`);
