import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  getBuildingPropEntry,
  getPeaceZoneMarkerEntry,
  getScatterPropEntry,
  listEnvironmentModelPaths,
} from './environment-manifest';

const PUBLIC_ROOT = join(import.meta.dirname, '../../public');

function publicPath(urlPath: string): string {
  return join(PUBLIC_ROOT, urlPath.replace(/^\//, ''));
}

describe('environment-manifest', () => {
  it('returns building entries 0–4 with environment paths and tuning fields', () => {
    for (let index = 0; index < 5; index++) {
      const entry = getBuildingPropEntry(index as 0 | 1 | 2 | 3 | 4);
      expect(entry.model).toMatch(/^\/models\/props\/environment\/Building_\d\.glb$/);
      expect(typeof entry.scale).toBe('number');
      expect(typeof entry.yOffset).toBe('number');
      expect(typeof entry.yRotation).toBe('number');
    }
  });

  it('returns scatter entries for tree and rock', () => {
    const tree = getScatterPropEntry('tree');
    const rock = getScatterPropEntry('rock');
    expect(tree.model).toBe('/models/props/environment/Tree.glb');
    expect(rock.model).toBe('/models/props/environment/Rock.glb');
    expect(typeof tree.scaleMultiplier).toBe('number');
    expect(typeof rock.scaleMultiplier).toBe('number');
  });

  it('returns peace-zone marker entry', () => {
    const marker = getPeaceZoneMarkerEntry();
    expect(marker.model).toBe('/models/props/environment/PeaceMarker.glb');
    expect(typeof marker.scale).toBe('number');
    expect(typeof marker.yOffset).toBe('number');
  });

  it('lists eight unique environment model paths', () => {
    const paths = listEnvironmentModelPaths();
    expect(paths).toHaveLength(8);
    expect(new Set(paths).size).toBe(8);
    expect(paths.every((p) => p.startsWith('/models/props/environment/'))).toBe(true);
  });

  it('references GLB files that exist on disk after asset ingest', () => {
    const missing = listEnvironmentModelPaths().filter((p) => !existsSync(publicPath(p)));
    expect(missing).toEqual([]);
  });
});
