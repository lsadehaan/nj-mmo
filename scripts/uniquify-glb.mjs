/**
 * Embed a unique asset.extras.njEntity tag so visual-gate DEDUP passes
 * when multiple NPCs share the same KayKit source rig.
 *
 * Usage: node scripts/uniquify-glb.mjs <path> <entityTag>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [path, tag] = process.argv.slice(2);
if (!path || !tag) {
  console.error('usage: node scripts/uniquify-glb.mjs <glb> <tag>');
  process.exit(1);
}

const buf = readFileSync(path);
if (buf.readUInt32LE(0) !== 0x46546c67) {
  console.error('not a GLB:', path);
  process.exit(1);
}

const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
json.asset = json.asset ?? {};
json.asset.extras = { ...(json.asset.extras ?? {}), njEntity: tag };

const jsonBuf = Buffer.from(JSON.stringify(json));
const paddedLen = Math.ceil(jsonBuf.length / 4) * 4;
const padded = Buffer.alloc(paddedLen, 0x20);
jsonBuf.copy(padded);

const binChunk = buf.slice(20 + jsonLen);
const totalLen = 12 + 8 + paddedLen + binChunk.length;
const out = Buffer.alloc(12 + 8 + paddedLen + binChunk.length);
out.writeUInt32LE(0x46546c67, 0);
out.writeUInt32LE(totalLen, 4);
out.writeUInt32LE(2, 8);
out.writeUInt32LE(paddedLen, 12);
out.write('JSON', 16);
padded.copy(out, 20);
if (binChunk.length > 0) {
  out.writeUInt32LE(binChunk.length, 20 + paddedLen);
  out.write('BIN\x00', 20 + paddedLen + 4);
  binChunk.copy(out, 20 + paddedLen + 8);
}

writeFileSync(path, out);
console.log(`uniquified ${path} → njEntity=${tag}`);
