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
  SPAWN_X,
  SPAWN_Z,
  type SeededRng,
} from '@nj/game-core';
import { getWalkabilityGrid, resetWalkabilityGridCache } from '@nj/game-core';
import { xmlParser } from './parsers/xml-utils';
import { parseMonsters } from './parsers/monsters.parser';
import type { MobSpawnFixtureRow } from './parsers/spawns.parser';
import { DEFAULT_L2J_DATA_DIR, FIXTURE_DATA_DIR, TI_MOB_IDS } from './paths';

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

/**
 * Minimum distance (world metres) enforced between any two mob spawns. The
 * L2J territories describe a world far larger than our 640 m vertical slice, so
 * faithfully expanding every territory `count` collapses hundreds of mobs into
 * a handful of small zones (≈290 within an 80 m radius). That made the fields
 * unplayable — a level-1 player is swarmed instantly — and is the dominant
 * client render cost. Spacing spawns apart caps local density to a level that
 * matches L2's "pull a few at a time" pacing while keeping every zone populated.
 */
export const MIN_SPAWN_SPACING = 14;

/**
 * Fraction of each L2J territory `count` we actually place. The Classic data
 * describes a full-size region; our 640 m slice keeps the same mob *variety*
 * and relative distribution but at a fraction of the raw count so the fields
 * stay playable for a solo level-1 character.
 */
export const SPAWN_COUNT_SCALE = 0.35;

function scaledCount(rawCount: number): number {
  if (rawCount <= 0) return 0;
  return Math.max(1, Math.round(rawCount * SPAWN_COUNT_SCALE));
}

/**
 * Every mob type keeps at least this many spawns even when its zone is already
 * saturated, so the slice preserves the full Classic bestiary (and the
 * spawn-placement tests that assert each TI mob id is present).
 */
export const MIN_SPAWNS_PER_MOB = 2;

/**
 * Newbie-safety gradient: stronger mobs must spawn at least this far (world
 * metres) from the village centre (the player SPAWN at the local origin). The
 * L2J Classic territories scatter a few higher-level species into fields that,
 * once collapsed into our 640 m slice, sit right against town — a fresh level-1
 * character would get ganked ~85 m outside the gate. Gating placement by level
 * keeps the immediate ring newbie-friendly while every legitimately distant mob
 * (level 8+ already lives 250 m+ out) is untouched. Tuned to the TI slice: only
 * the near-village strays are pushed out, nothing far is moved.
 */
export function minSpawnDistanceFromVillage(level: number): number {
  if (level >= 8) return 220;
  if (level >= 6) return 140;
  return 0;
}

/**
 * Maps a monster level to the radial zone it spawns in. This is what spreads
 * the bestiary around the village instead of bunching it on one side: each tier
 * lands in a different sector (see the polygon layout in `ti-zones.ts`), with
 * difficulty rising as you move away from town. Driving placement by level —
 * rather than by the L2J territory's natural (all-western) position — is the
 * core of the "lower near, higher far, spread around" layout.
 */
export function zoneForLevel(level: number): string {
  if (level <= 4) return 'eastern_fields'; // east, near
  if (level <= 7) return 'obelisk'; // north, near
  if (level <= 10) return 'harbor'; // south-west, far
  if (level <= 13) return 'cave_of_souls'; // south, far
  return 'elven_ruins'; // west, far
}

function isTooFarFromAllowedRing(x: number, z: number, minDist: number): boolean {
  if (minDist <= 0) return false;
  const dx = x - SPAWN_X;
  const dz = z - SPAWN_Z;
  return dx * dx + dz * dz < minDist * minDist;
}

function isTooClose(
  x: number,
  z: number,
  placed: { x: number; z: number }[],
  spacingSq: number
): boolean {
  for (const p of placed) {
    const dx = p.x - x;
    const dz = p.z - z;
    if (dx * dx + dz * dz < spacingSq) return true;
  }
  return false;
}

function acceptSpawn(
  x: number,
  z: number,
  placed: { x: number; z: number }[],
  spacingSq: number,
  minDistFromVillage: number
): { x: number; z: number } | null {
  const snapped = snapToNearestWalkable(x, z, 20);
  if (!snapped) return null;
  if (isInPeaceZone(snapped.x, snapped.z) || isWaterZone(snapped.x, snapped.z)) {
    return null;
  }
  if (isTooFarFromAllowedRing(snapped.x, snapped.z, minDistFromVillage)) return null;
  const pos = { x: snapped.x, z: snapped.z };
  if (!isWalkable(pos, pos)) return null;
  if (isTooClose(snapped.x, snapped.z, placed, spacingSq)) return null;
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

/**
 * Try to place one spawn honouring walkability and minimum spacing. Returns
 * null when the area is already saturated, so over-dense territory counts are
 * thinned rather than stacked (we no longer throw — a saturated zone simply
 * holds fewer mobs).
 */
function placeSpawnPoint(
  polygon: { x: number; z: number }[],
  rng: SeededRng,
  zoneId: string,
  placed: { x: number; z: number }[],
  minDistFromVillage: number,
  spacing: number = MIN_SPAWN_SPACING
): { x: number; z: number } | null {
  const scatterPoly = scatterPolygonForZone(polygon, zoneId);
  const spacingSq = spacing * spacing;
  for (let attempt = 0; attempt < 80; attempt++) {
    const { x, z } = randomPointInPolygon(scatterPoly, rng);
    const point = acceptSpawn(x, z, placed, spacingSq, minDistFromVillage);
    if (point) return point;
  }
  return null;
}

function parseRespawnSec(value: string | undefined): number {
  if (!value) return 27;
  const m = value.match(/(\d+)/);
  return m ? Number(m[1]) : 27;
}

export function buildMobSpawnsFromXml(
  xml: string,
  rng: SeededRng = createSeededRng(42),
  levelByNpcId: ReadonlyMap<number, number> = new Map()
): MobSpawnFixtureRow[] {
  const doc = xmlParser.parse(xml) as SpawnDoc;
  const spawns = asArray(doc.list?.spawn);
  const rows: MobSpawnFixtureRow[] = [];
  const placed: { x: number; z: number }[] = [];
  const perMobCount = new Map<number, number>();

  interface SpawnGroup {
    npcId: number;
    respawnSec: number;
    zoneId: string;
    polygon: { x: number; z: number }[];
    desired: number;
    minDistFromVillage: number;
  }
  const groups: SpawnGroup[] = [];

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
        const level = levelByNpcId.get(npcId) ?? 0;
        groups.push({
          npcId,
          respawnSec: parseRespawnSec(npc['@_respawnTime']),
          // Spread by level tier around the village; the territory's natural
          // (western) zone is kept only for the `territoryZoneMap` lookup above.
          zoneId: zoneForLevel(level),
          polygon,
          desired: scaledCount(Number(npc['@_count'] ?? 1)),
          minDistFromVillage: minSpawnDistanceFromVillage(level),
        });
      }
    }
  }

  const emit = (group: SpawnGroup, point: { x: number; z: number }): void => {
    placed.push(point);
    rows.push({ npcId: group.npcId, x: point.x, z: point.z, respawnSec: group.respawnSec });
    perMobCount.set(group.npcId, (perMobCount.get(group.npcId) ?? 0) + 1);
  };

  // Pass 1: scaled counts at full spacing; crowded spots are simply skipped.
  for (const group of groups) {
    for (let i = 0; i < group.desired; i++) {
      const point = placeSpawnPoint(
        group.polygon,
        rng,
        group.zoneId,
        placed,
        group.minDistFromVillage
      );
      if (point) emit(group, point);
    }
  }

  // Pass 2: guarantee every mob type reaches the floor, relaxing spacing only
  // for the under-represented types so saturated zones never erase a species.
  // The newbie-safety distance gate still applies — a high-level species reaches
  // its floor through its far-ring territories, never by creeping back to town.
  for (const group of groups) {
    let guard = 0;
    while ((perMobCount.get(group.npcId) ?? 0) < MIN_SPAWNS_PER_MOB && guard < 40) {
      guard += 1;
      const point = placeSpawnPoint(
        group.polygon,
        rng,
        group.zoneId,
        placed,
        group.minDistFromVillage,
        MIN_SPAWN_SPACING / 2
      );
      if (point) emit(group, point);
      else break;
    }
  }

  return rows;
}

/*
 * Guaranteed newbie spawns just outside the east village gate (inside the
 * Eastern Fields zone). The Tutorial quest needs a Gremlin kill, so we plant a
 * findable cluster of Gremlins (plus a couple of Goblins) right where a fresh
 * character first steps out, instead of relying on the thin territory rolls.
 */
const TUTORIAL_MOB_ROWS: MobSpawnFixtureRow[] = [
  { npcId: 20001, x: 56, z: 4, respawnSec: 27 },
  { npcId: 20001, x: 60, z: -8, respawnSec: 27 },
  { npcId: 20001, x: 64, z: 12, respawnSec: 27 },
  { npcId: 20001, x: 58, z: 18, respawnSec: 27 },
  { npcId: 20001, x: 70, z: -2, respawnSec: 27 },
  { npcId: 20001, x: 68, z: 24, respawnSec: 27 },
  { npcId: 20003, x: 74, z: 10, respawnSec: 27 },
  { npcId: 20003, x: 78, z: -6, respawnSec: 27 },
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
  const monstersXml = readFileSync(join(FIXTURE_DATA_DIR, 'monsters.xml'), 'utf-8');
  const levelByNpcId = new Map(
    parseMonsters(monstersXml, [...TI_MOB_IDS]).map((m) => [m.npcId, m.level])
  );
  const territoryRows = buildMobSpawnsFromXml(xml, undefined, levelByNpcId);
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
