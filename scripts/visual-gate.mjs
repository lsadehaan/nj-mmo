/**
 * Visual gate — STRUCTURAL fidelity checks for game assets (AD-017).
 *
 * This is the deterministic, no-human, no-vision first layer of the asset gate.
 * It exists because the autonomous loop once shipped a mage as a "building" and a
 * deer as a "tree" by copying whatever GLB was already in the repo. Those failures
 * are all catchable WITHOUT looking at a pixel:
 *
 *   - DEDUP:      two differently-named entities with byte-identical GLBs ⇒ a
 *                 lazy copy (Gremlin == Mage, Tree == Wolf, Building == character).
 *   - CATEGORY:   a static prop (building/tree/rock/weapon) must have NO skeleton
 *                 and NO animations; a creature/character/NPC must HAVE both.
 *   - DENYLIST:   a "building"/"tree"/"rock" whose nodes are Ear/Head/Spine/Hips/
 *                 Spellbook is obviously a creature, not a prop.
 *   - NON-EMPTY:  a ~1 KB GLB with no mesh geometry is a degenerate stub.
 *
 * Structural PASS is necessary but NOT sufficient — it cannot tell a mage from a
 * gremlin (both are valid rigged characters). That semantic "is this actually the
 * thing?" judgement is the FIDELITY/vision step the skill mandates on top of this.
 *
 * Usage:  node scripts/visual-gate.mjs            # check all models
 *         node scripts/visual-gate.mjs --json     # machine-readable verdict
 * Exit code 0 = all PASS, 1 = at least one FAIL.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS_DIR = join(root, 'client/public/models');

/** Which folder implies which asset category + its structural contract. */
const CATEGORY_RULES = [
  { match: /\/models\/(characters|monsters|npcs)\//, kind: 'rigged' },
  { match: /\/models\/props\//, kind: 'static' }, // includes props/environment/*
];

/** Node names that must NOT appear in a STATIC prop (they prove it's a creature). */
const CREATURE_NODE_DENYLIST = [
  'ear', 'head', 'neck', 'spine', 'hips', 'pelvis', 'tail', 'jaw', 'eye',
  'upperarm', 'lowerarm', 'thigh', 'shin', 'foot', 'hand', 'finger', 'shoulder',
  'armature', 'spellbook', 'wrist', 'handslot', 'leg', 'toe',
];

function walkGlbs(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkGlbs(p));
    else if (entry.toLowerCase().endsWith('.glb')) out.push(p);
  }
  return out;
}

/** Parse the JSON chunk + size facts out of a binary GLB. */
function readGlb(path) {
  const buf = readFileSync(path);
  const sha = createHash('sha256').update(buf).digest('hex');
  let json = null;
  try {
    const jsonLen = buf.readUInt32LE(12);
    json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  } catch {
    /* leave json null — handled as a structural failure */
  }
  return { buf, sha, json, bytes: buf.length };
}

function categoryOf(absPath) {
  const unix = absPath.split('\\').join('/');
  for (const rule of CATEGORY_RULES) if (rule.match.test(unix)) return rule.kind;
  return 'unknown';
}

function meshHasGeometry(json) {
  const meshes = json.meshes || [];
  return meshes.some((m) => (m.primitives || []).length > 0);
}

function nodeNames(json) {
  return (json.nodes || []).map((n) => (n.name || '').toLowerCase());
}

function analyze(path) {
  const rel = relative(root, path);
  const kind = categoryOf(path);
  const { sha, json, bytes } = readGlb(path);
  const failures = [];

  if (!json) {
    failures.push('not a parseable GLB (no JSON chunk)');
    return { rel, kind, sha, bytes, anims: 0, skins: 0, failures };
  }

  const anims = (json.animations || []).length;
  const skins = (json.skins || []).length;
  const hasGeo = meshHasGeometry(json);

  if (!hasGeo) failures.push(`empty: no mesh geometry (${(bytes / 1024).toFixed(0)} KB stub)`);

  if (kind === 'static') {
    if (skins > 0) failures.push(`static prop has a skeleton (${skins} skin) — it's a rigged creature/character`);
    if (anims > 0) failures.push(`static prop has ${anims} animation clip(s) — props must be inert`);
    const hits = nodeNames(json).filter((n) => CREATURE_NODE_DENYLIST.some((d) => n.includes(d)));
    if (hits.length) failures.push(`static prop has creature/character bones: ${[...new Set(hits)].slice(0, 6).join(', ')}`);
  } else if (kind === 'rigged') {
    if (skins === 0) failures.push('rigged entity has no skeleton (skins=0)');
    if (anims === 0) failures.push('rigged entity has no animation clips');
  } else {
    failures.push(`unknown category for path (not under characters/monsters/npcs/props)`);
  }

  return { rel, kind, sha, bytes, anims, skins, failures };
}

function main() {
  const asJson = process.argv.includes('--json');
  const files = walkGlbs(MODELS_DIR).sort();
  const results = files.map(analyze);

  // DEDUP: group by sha; any group with >1 distinct entity name is a copy.
  const byHash = new Map();
  for (const r of results) {
    if (!byHash.has(r.sha)) byHash.set(r.sha, []);
    byHash.get(r.sha).push(r);
  }
  for (const group of byHash.values()) {
    if (group.length > 1) {
      const names = group.map((g) => basename(g.rel)).join(' = ');
      for (const r of group) {
        r.failures.push(`duplicate asset (byte-identical copy): ${names} — a real entity must have its own mesh`);
      }
    }
  }

  const failed = results.filter((r) => r.failures.length > 0);

  if (asJson) {
    console.log(JSON.stringify({ pass: failed.length === 0, results }, null, 2));
  } else {
    for (const r of results) {
      const ok = r.failures.length === 0;
      const tag = ok ? 'PASS' : 'FAIL';
      console.log(`[${tag}] ${r.rel}  (${r.kind}, ${(r.bytes / 1024).toFixed(0)}KB, skins=${r.skins}, anims=${r.anims})`);
      for (const f of r.failures) console.log(`        ↳ ${f}`);
    }
    console.log(
      `\n${results.length - failed.length}/${results.length} PASS — ${failed.length} FAIL`
    );
    if (failed.length) {
      console.log(
        '\nStructural PASS is necessary, not sufficient: a structurally-valid rigged\n' +
          'asset can still be the WRONG creature (mage rendered as "Gremlin"). The\n' +
          'fidelity/vision step (render + look + match against the entity description)\n' +
          'is still required on every PASS before a phase is marked done.'
      );
    }
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main();
