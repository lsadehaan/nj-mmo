/**
 * Regenerate npc_spawns.json from L2J Gludio.xml TI cluster.
 * Run: node scripts/generate-ti-npc-spawns.mjs
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_L2J_DATA_DIR } from '../server/src/seed/paths.ts';
import { writeNpcSpawnFixture } from '../server/src/seed/npc-spawn-fixture.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gludio = join(DEFAULT_L2J_DATA_DIR, 'spawns/Gludio/Gludio.xml');
const out = join(root, 'server/src/seed/__fixtures__/npc_spawns.json');
writeNpcSpawnFixture(out, gludio);
console.log(`Wrote TI NPC spawns to ${out}`);
