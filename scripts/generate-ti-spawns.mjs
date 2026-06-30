/**
 * Regenerate mob_spawns.json from L2J TalkingIslandMonsters.xml.
 * Run: node scripts/generate-ti-spawns.mjs
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMobSpawnFixture } from '../server/src/seed/territory-spawns.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'server/src/seed/__fixtures__/mob_spawns.json');
const rows = buildMobSpawnFixture();
writeFileSync(out, `${JSON.stringify(rows, null, 2)}\n`);
console.log(`Wrote ${rows.length} mob spawn rows to ${out}`);
