/**
 * Import CC0 pack assets from ~/Downloads/packs into client/public/models.
 *
 * Policy: reuse downloaded packs first (KayKit / Quaternius). Buildings are the
 * exception — they are hand-authored in scripts/build-houses.mjs because the
 * modular village kit does not ship complete, closed houses.
 *
 * Run: node scripts/import-pack-assets.mjs
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = join(homedir(), 'Downloads', 'packs');
const NATURE = join(PACKS, 'Stylized Nature MegaKit[Standard]', 'glTF');
const FANTASY = join(PACKS, 'Fantasy Props MegaKit[Standard]', 'Exports', 'glTF');
const MONSTERS = join(PACKS, 'Ultimate Monsters');

const OUT = {
  env: join(root, 'client/public/models/props/environment'),
  props: join(root, 'client/public/models/props'),
  monsters: join(root, 'client/public/models/monsters'),
};

for (const dir of Object.values(OUT)) mkdirSync(dir, { recursive: true });

function assertPack(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing pack path (${label}): ${path}`);
  }
}

function copyGltf(src, destGlb) {
  execSync(`npx --yes @gltf-transform/cli copy "${src}" "${destGlb}"`, {
    stdio: 'inherit',
  });
}

/**
 * Shrink embedded textures (KayKit/Quaternius ship 2K PNGs): cap at 1024 and
 * re-encode to WebP. Both ops touch textures only — geometry, skins, and
 * animation clips are preserved, and Three.js decodes WebP natively, so no
 * client loader changes are required.
 */
function optimizeTextures(glbPath) {
  const tmp = `${glbPath}.tmp.glb`;
  execSync(
    `npx --yes @gltf-transform/cli resize "${glbPath}" "${tmp}" --width 1024 --height 1024`,
    { stdio: 'ignore' },
  );
  execSync(`npx --yes @gltf-transform/cli webp "${tmp}" "${glbPath}"`, { stdio: 'ignore' });
  rmSync(tmp, { force: true });
}

function optimizeAll() {
  for (const dir of [OUT.env, OUT.props, OUT.monsters]) {
    for (const file of readdirSync(dir)) {
      if (!file.toLowerCase().endsWith('.glb')) continue;
      if (/^Building_/.test(file)) continue; // hand-authored, no embedded textures
      const p = join(dir, file);
      const before = readFileSync(p).length;
      optimizeTextures(p);
      const after = readFileSync(p).length;
      console.log(
        `optimized ${file} (${(before / 1024 / 1024).toFixed(1)} MB → ${(after / 1024 / 1024).toFixed(2)} MB)`,
      );
    }
  }
}

async function main() {
  assertPack(PACKS, 'packs root');
  assertPack(NATURE, 'Stylized Nature');
  assertPack(FANTASY, 'Fantasy Props');
  assertPack(MONSTERS, 'Ultimate Monsters');

  // ── Environment scatter + marker (Nature + Fantasy) ───────────────────────
  // Buildings are hand-authored separately — see scripts/build-houses.mjs.
  copyGltf(join(NATURE, 'CommonTree_3.gltf'), join(OUT.env, 'Tree.glb'));
  copyGltf(join(NATURE, 'Rock_Medium_2.gltf'), join(OUT.env, 'Rock.glb'));
  copyGltf(join(FANTASY, 'Banner_1.gltf'), join(OUT.env, 'PeaceMarker.glb'));

  // ── Weapons (Fantasy Props) ───────────────────────────────────────────────
  copyGltf(join(FANTASY, 'Sword_Bronze.gltf'), join(OUT.props, 'SquiresSword.glb'));
  copyGltf(join(FANTASY, 'Axe_Bronze.gltf'), join(OUT.props, 'GoblinClub.glb'));

  // ── Monsters (Ultimate Monsters / Quaternius) ─────────────────────────────
  copyGltf(join(MONSTERS, 'Blob/glTF/GreenSpikyBlob.gltf'), join(OUT.monsters, 'Gremlin.glb'));
  copyGltf(join(MONSTERS, 'Blob/glTF/Orc.gltf'), join(OUT.monsters, 'Goblin.glb'));

  // ── Phase 16 TI mobs ──────────────────────────────────────────────────────
  copyGltf(join(MONSTERS, 'Big/glTF/Bunny.gltf'), join(OUT.monsters, 'Elpy.glb'));
  copyGltf(join(MONSTERS, 'Big/glTF/Monkroose.gltf'), join(OUT.monsters, 'ElderKeltir.glb'));
  copyGltf(join(MONSTERS, 'Big/glTF/Dino.gltf'), join(OUT.monsters, 'ElderWolf.glb'));
  copyGltf(join(MONSTERS, 'Big/glTF/Frog.gltf'), join(OUT.monsters, 'GiantToad.glb'));
  copyGltf(join(MONSTERS, 'Big/glTF/Orc.gltf'), join(OUT.monsters, 'Orc.glb'));

  // ── Phase 22 TI bestiary ──────────────────────────────────────────────────
  copyGltf(join(MONSTERS, 'Big/glTF/Tribal.gltf'), join(OUT.monsters, 'OrcSoldier.glb'));
  copyGltf(join(MONSTERS, 'Big/glTF/Ninja.gltf'), join(OUT.monsters, 'OrcArcher.glb'));
  copyGltf(join(MONSTERS, 'Blob/glTF/Ninja.gltf'), join(OUT.monsters, 'GoblinScout.glb'));
  copyGltf(join(MONSTERS, 'Blob/glTF/Yeti.gltf'), join(OUT.monsters, 'Werewolf.glb'));
  copyGltf(join(MONSTERS, 'Big/glTF/Yeti.gltf'), join(OUT.monsters, 'WerewolfHunter.glb'));
  copyGltf(join(MONSTERS, 'Big/glTF/Orc_Skull.gltf'), join(OUT.monsters, 'OrcWarrior.glb'));
  copyGltf(join(MONSTERS, 'Big/glTF/Demon.gltf'), join(OUT.monsters, 'OrcLieutenant.glb'));
  copyGltf(join(MONSTERS, 'Big/glTF/BlueDemon.gltf'), join(OUT.monsters, 'OrcCaptain.glb'));
  copyGltf(join(MONSTERS, 'Big/glTF/MushroomKing.gltf'), join(OUT.monsters, 'WerewolfChieftain.glb'));
  copyGltf(join(MONSTERS, 'Flying/glTF/Goleling.gltf'), join(OUT.monsters, 'StoneGolem.glb'));
  copyGltf(join(MONSTERS, 'Blob/glTF/Cactoro.gltf'), join(OUT.monsters, 'Crasher.glb'));
  copyGltf(join(MONSTERS, 'Flying/glTF/Squidle.gltf'), join(OUT.monsters, 'GiantSpider.glb'));
  copyGltf(join(MONSTERS, 'Flying/glTF/Armabee.gltf'), join(OUT.monsters, 'GiantFangSpider.glb'));
  copyGltf(join(MONSTERS, 'Flying/glTF/Armabee_Evolved.gltf'), join(OUT.monsters, 'GiantBladeSpider.glb'));

  writeFileSync(
    join(OUT.env, 'LICENSE.txt'),
    `Environment assets imported from ~/Downloads/packs (pre-live prototyping).

Tree.glb — Quaternius "Stylized Nature MegaKit" (CC0)
  Source: CommonTree_3.gltf

Rock.glb — Quaternius "Stylized Nature MegaKit" (CC0)
  Source: Rock_Medium_2.gltf

PeaceMarker.glb — KayKit "Fantasy Props MegaKit" (CC0)
  Source: Banner_1.gltf

Building_0.glb – Building_4.glb — hand-authored (see BUILDINGS_LICENSE.txt and
  scripts/build-houses.mjs). NOT produced by this importer.

Imported by: node scripts/import-pack-assets.mjs
`,
  );

  writeFileSync(
    join(OUT.props, 'LICENSE.txt'),
    `Weapon props imported from KayKit "Fantasy Props MegaKit" (CC0).

SquiresSword.glb — Sword_Bronze.gltf
GoblinClub.glb — Axe_Bronze.gltf (club stand-in; no club mesh in pack)

Imported by: node scripts/import-pack-assets.mjs
`,
  );

  writeFileSync(
    join(OUT.monsters, 'LICENSE.txt'),
    `Monster models imported from Quaternius "Ultimate Monsters" (CC0).

Gremlin.glb — GreenSpikyBlob.gltf (Blob)
Goblin.glb — Orc.gltf (Blob)
Wolf.glb, BeardedKeltir.glb — Quaternius Ultimate Animated Animals (CC0)

Phase 16 — Talking Island mob expansion:
Elpy.glb — Big/Bunny.gltf
ElderKeltir.glb — Big/Monkroose.gltf
ElderWolf.glb — Big/Dino.gltf (distinct quadruped from Wolf.glb)
GiantToad.glb — Big/Frog.gltf
Orc.glb — Big/Orc.gltf (humanoid biped; NOT Blob Orc used by Goblin)

Phase 22 — Complete TI bestiary:
OrcSoldier.glb — Big/Tribal.gltf
OrcArcher.glb — Big/Ninja.gltf
GoblinScout.glb — Blob/Ninja.gltf
Werewolf.glb — Blob/Yeti.gltf
WerewolfHunter.glb — Big/Yeti.gltf
OrcWarrior.glb — Big/Orc_Skull.gltf
OrcLieutenant.glb — Big/Demon.gltf
OrcCaptain.glb — Big/BlueDemon.gltf
WerewolfChieftain.glb — Big/MushroomKing.gltf
StoneGolem.glb — Flying/Goleling.gltf
Crasher.glb — Blob/Cactoro.gltf
GiantSpider.glb — Flying/Squidle.gltf
GiantFangSpider.glb — Flying/Armabee.gltf
GiantBladeSpider.glb — Flying/Armabee_Evolved.gltf

Clip maps: creature-manifest.ts
  Blob: ULTIMATE_MONSTER_CLIP_MAP (Idle, Walk, Bite_Front, Death)
  Animals: QUATERNIUS_WOLF_CLIP_MAP / QUATERNIUS_DEER_CLIP_MAP
  Big: ULTIMATE_BIG_MONSTER_CLIP_MAP (Idle, Walk, Punch, Death)
  Flying: QUATERNIUS_FLYING_CLIP_MAP (Flying_Idle, Fast_Flying, Punch, Death)

Pre-launch: swap CC0 stand-ins for licensed L2-authentic assets where required (AD-004).

Imported by: node scripts/import-pack-assets.mjs
`,
  );

  console.log('\nOptimizing textures (resize 1024 + WebP)...');
  optimizeAll();

  console.log('\nAll pack assets imported. Run: node scripts/visual-gate.mjs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
