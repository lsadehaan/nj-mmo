import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  l2ToLocal,
  createSeededRng,
  isWalkable,
  isInPeaceZone,
  isWaterZone,
  getZoneAt,
  snapToNearestWalkable,
  listTiZones,
  type SeededRng,
} from '@nj/game-core';
import { getWalkabilityGrid, resetWalkabilityGridCache } from '@nj/game-core';
import { xmlParser } from './parsers/xml-utils';
import type { MobSpawnFixtureRow } from './parsers/spawns.parser';
import { DEFAULT_L2J_DATA_DIR } from './paths';

interface TerritoryNode {
  '@_x': string;
  '@_y': string;
}

interface Territory {
  '@_name': string;
  node?: TerritoryNode | TerritoryNode[];
}

interface SpawnNpc {
  '@_id': string;
  '@_count': string;
  '@_respawnTime'?: string;
}

interface SpawnBlock {
  territories?: { territory?: Territory | Territory[] };
  npc?: SpawnNpc | SpawnNpc[];
}

interface SpawnDoc {
  list?: { spawn?: SpawnBlock | SpawnBlock[] };
}

export const territoryZoneMap: Record<string, string> = {};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function territoryCentroidL2(nodes: TerritoryNode[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const n of nodes) {
    sx += Number(n['@_x']);
    sy += Number(n['@_y']);
  }
  return { x: sx / nodes.length, y: sy / nodes.length };
}

function territoryToLocalPolygon(nodes: TerritoryNode[]): { x: number; z: number }[] {
  return nodes.map((n) => l2ToLocal(Number(n['@_x']), Number(n['@_y'])));
}

function bboxOf(polygon: { x: number; z: number }[]): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const xs = polygon.map((p) => p.x);
  const zs = polygon.map((p) => p.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

function pointInPolygon(
  x: number,
  z: number,
  polygon: { x: number; z: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;
    const intersect =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function randomPointInPolygon(
  polygon: { x: number; z: number }[],
  rng: SeededRng
): { x: number; z: number } {
  const { minX, maxX, minZ, maxZ } = bboxOf(polygon);
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = minX + rng.nextFloat() * (maxX - minX);
    const z = minZ + rng.nextFloat() * (maxZ - minZ);
    if (pointInPolygon(x, z, polygon)) return { x, z };
  }
  const cx = polygon.reduce((s, p) => s + p.x, 0) / polygon.length;
  const cz = polygon.reduce((s, p) => s + p.z, 0) / polygon.length;
  return { x: cx, z: cz };
}

export function resolveTerritoryZoneId(
  territoryName: string,
  centroidL2: { x: number; y: number }
): string {
  if (territoryName.startsWith('gludio31_1725_')) return 'eastern_fields';
  if (territoryName.startsWith('gludio31_1624_')) return 'elven_ruins';
  if (territoryName.startsWith('gludio31_1625_')) {
    const local = l2ToLocal(centroidL2.x, centroidL2.y);
    const distRuins = Math.hypot(local.x - -281, local.z - 87);
    return distRuins < 50 ? 'elven_ruins' : 'cave_of_souls';
  }
  if (territoryName.startsWith('gludio32_1725_')) return 'eastern_fields';
  if (centroidL2.y > 248000) {
    return centroidL2.y > 250000 ? 'cave_of_souls' : 'harbor';
  }
  const local = l2ToLocal(centroidL2.x, centroidL2.y);
  return getZoneAt(local.x, local.z).zoneId;
}

function acceptSpawn(x: number, z: number): { x: number; z: number } | null {
  const snapped = snapToNearestWalkable(x, z, 20);
  if (!snapped) return null;
  if (isInPeaceZone(snapped.x, snapped.z) || isWaterZone(snapped.x, snapped.z)) {
    return null;
  }
  const pos = { x: snapped.x, z: snapped.z };
  if (!isWalkable(pos, pos)) return null;
  return {
    x: Math.round(snapped.x * 100) / 100,
    z: Math.round(snapped.z * 100) / 100,
  };
}

function scatterPolygonForZone(
  territoryPolygon: { x: number; z: number }[],
  zoneId: string
): { x: number; z: number }[] {
  if (zoneId === 'wilderness') return territoryPolygon;
  const zone = listTiZones().find((z) => z.id === zoneId);
  return zone ? [...zone.polygon] : territoryPolygon;
}

function placeSpawnPoint(
  polygon: { x: number; z: number }[],
  rng: SeededRng,
  territoryName: string,
  zoneId: string
): { x: number; z: number } {
  const scatterPoly = scatterPolygonForZone(polygon, zoneId);
  for (let attempt = 0; attempt < 80; attempt++) {
    const { x, z } = randomPointInPolygon(scatterPoly, rng);
    const placed = acceptSpawn(x, z);
    if (placed) return placed;
  }

  const cx = scatterPoly.reduce((s, p) => s + p.x, 0) / scatterPoly.length;
  const cz = scatterPoly.reduce((s, p) => s + p.z, 0) / scatterPoly.length;
  const fallback = acceptSpawn(cx, cz);
  if (fallback) return fallback;

  throw new Error(
    `Failed to place walkable spawn for territory ${territoryName} after retries`
  );
}

function parseRespawnSec(value: string | undefined): number {
  if (!value) return 27;
  const m = value.match(/(\d+)/);
  return m ? Number(m[1]) : 27;
}

export function buildMobSpawnsFromXml(
  xml: string,
  rng: SeededRng = createSeededRng(42)
): MobSpawnFixtureRow[] {
  const doc = xmlParser.parse(xml) as SpawnDoc;
  const spawns = asArray(doc.list?.spawn);
  const rows: MobSpawnFixtureRow[] = [];

  for (const block of spawns) {
    const territories = asArray(block.territories?.territory);
    if (territories.length === 0) continue;

    for (const territory of territories) {
      const name = territory['@_name'];
      const nodes = asArray(territory.node);
      if (nodes.length < 3) continue;

      const centroidL2 = territoryCentroidL2(nodes);
      const zoneId = resolveTerritoryZoneId(name, centroidL2);
      territoryZoneMap[name] = zoneId;

      const polygon = territoryToLocalPolygon(nodes);
      for (const npc of asArray(block.npc)) {
        const npcId = Number(npc['@_id']);
        const count = Number(npc['@_count'] ?? 1);
        const respawnSec = parseRespawnSec(npc['@_respawnTime']);
        for (let i = 0; i < count; i++) {
          const { x, z } = placeSpawnPoint(polygon, rng, name, zoneId);
          rows.push({ npcId, x, z, respawnSec });
        }
      }
    }
  }

  return rows;
}

const TUTORIAL_MOB_ROWS: MobSpawnFixtureRow[] = [
  { npcId: 20001, x: -48, z: 5, respawnSec: 27 },
  { npcId: 20001, x: -52, z: 8, respawnSec: 27 },
  { npcId: 20003, x: -55, z: 12, respawnSec: 27 },
  { npcId: 20003, x: -58, z: 15, respawnSec: 27 },
];

export function buildMobSpawnFixture(
  xmlPath = join(
    DEFAULT_L2J_DATA_DIR,
    'spawns/TalkingIsland/TalkingIslandMonsters.xml'
  )
): MobSpawnFixtureRow[] {
  resetWalkabilityGridCache();
  getWalkabilityGrid();
  const xml = readFileSync(xmlPath, 'utf-8');
  const territoryRows = buildMobSpawnsFromXml(xml);
  return [...territoryRows, ...TUTORIAL_MOB_ROWS];
}

export function writeMobSpawnFixture(
  outPath: string,
  xmlPath?: string
): MobSpawnFixtureRow[] {
  const rows = buildMobSpawnFixture(xmlPath);
  writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`);
  return rows;
}
