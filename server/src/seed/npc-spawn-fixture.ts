import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  l2ToLocal,
  isInPeaceZone,
  isNpcSpawnBlocked,
  getZoneAt,
} from '@nj/game-core';
import { xmlParser } from './parsers/xml-utils';
import type { NpcSpawnFixtureRow } from './parsers/npc-spawns.parser';
import { TI_NPC_IDS } from './paths';

interface NpcNode {
  '@_id': string;
  '@_x': string;
  '@_y': string;
  '@_heading'?: string;
}

interface GludioDoc {
  list?: {
    spawn?: {
      group?: { npc?: NpcNode | NpcNode[] } | { npc?: NpcNode | NpcNode[] }[];
    };
  };
}

function collectGludioNpcs(doc: GludioDoc): NpcNode[] {
  const spawns = asArray(doc.list?.spawn);
  const nodes: NpcNode[] = [];
  for (const spawn of spawns) {
    for (const group of asArray(spawn.group)) {
      nodes.push(...asArray(group.npc));
    }
  }
  return nodes;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function nudgeNpcSpawn(x: number, z: number): { x: number; z: number } {
  if (
    isInPeaceZone(x, z) &&
    !isNpcSpawnBlocked(x, z) &&
    getZoneAt(x, z).zoneId === 'ti_village'
  ) {
    return { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 };
  }

  for (let r = 0.5; r <= 8; r += 0.5) {
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      const nx = x + Math.cos(angle) * r;
      const nz = z + Math.sin(angle) * r;
      if (
        isInPeaceZone(nx, nz) &&
        !isNpcSpawnBlocked(nx, nz) &&
        getZoneAt(nx, nz).zoneId === 'ti_village'
      ) {
        return { x: Math.round(nx * 100) / 100, z: Math.round(nz * 100) / 100 };
      }
    }
  }

  throw new Error(`Could not place NPC at (${x}, ${z}) in ti_village`);
}

function tryPlaceNpc(x: number, z: number): { x: number; z: number } | null {
  try {
    return nudgeNpcSpawn(x, z);
  } catch {
    return null;
  }
}

/** L2J Gludio TI cluster coords for NPCs missing or misplaced in source XML. */
const FALLBACK_L2: Record<number, { x: number; y: number; heading?: number }> = {
  // Vivyan's Gludio row points at Gludin; place beside Minia in the temple cluster.
  30030: { x: -83400, y: 243200, heading: 45956 },
  // Iris lives in Gludin XML only; place with the magister folk group.
  30034: { x: -85200, y: 245100, heading: 57000 },
};

function placeNpcFromL2(
  npcId: number,
  l2x: number,
  l2y: number,
  heading?: number
): NpcSpawnFixtureRow {
  const local = l2ToLocal(l2x, l2y);
  const placed = tryPlaceNpc(local.x, local.z);
  if (placed) {
    return { npcId, x: placed.x, z: placed.z, heading };
  }
  const fallback = FALLBACK_L2[npcId];
  if (fallback) {
    const fbLocal = l2ToLocal(fallback.x, fallback.y);
    const fbPlaced = nudgeNpcSpawn(fbLocal.x, fbLocal.z);
    return {
      npcId,
      x: fbPlaced.x,
      z: fbPlaced.z,
      heading: fallback.heading ?? heading,
    };
  }
  throw new Error(`Could not place NPC ${npcId} at (${local.x}, ${local.z}) in ti_village`);
}

export function buildNpcSpawnFixture(
  gludioXmlPath: string
): NpcSpawnFixtureRow[] {
  const xml = readFileSync(gludioXmlPath, 'utf-8');
  const doc = xmlParser.parse(xml) as GludioDoc;
  const nodes = collectGludioNpcs(doc);
  const idSet = new Set(TI_NPC_IDS.map(String));
  const rows: NpcSpawnFixtureRow[] = [];
  const seen = new Set<number>();

  for (const node of nodes) {
    const npcId = Number(node['@_id']);
    if (!idSet.has(String(npcId))) continue;
    seen.add(npcId);
    const l2x = Number(node['@_x']);
    const l2y = Number(node['@_y']);
    const heading = node['@_heading'] ? Number(node['@_heading']) : undefined;
    rows.push(placeNpcFromL2(npcId, l2x, l2y, heading));
  }

  for (const npcId of TI_NPC_IDS) {
    if (seen.has(npcId)) continue;
    const fallback = FALLBACK_L2[npcId];
    if (!fallback) {
      throw new Error(`Missing Gludio spawn and no fallback for npcId ${npcId}`);
    }
    rows.push(placeNpcFromL2(npcId, fallback.x, fallback.y, fallback.heading));
  }

  rows.sort((a, b) => a.npcId - b.npcId);
  if (rows.length !== TI_NPC_IDS.length) {
    throw new Error(`Expected ${TI_NPC_IDS.length} TI NPC rows, got ${rows.length}`);
  }
  return rows;
}

export function writeNpcSpawnFixture(outPath: string, gludioXmlPath: string): void {
  const rows = buildNpcSpawnFixture(gludioXmlPath);
  writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`);
}
