import { describe, it, expect } from 'vitest';
import { SpatialHash } from './spatial-hash';

describe('SpatialHash', () => {
  it('queryRadius returns ids within radius only', () => {
    const index = new SpatialHash<string>(10);
    index.set('near', 0, 0);
    index.set('far', 100, 0);
    index.set('edge', 9, 0);

    const hits = index.queryRadius(0, 0, 10);
    expect(hits.sort()).toEqual(['edge', 'near']);
  });

  it('set moves id between cells', () => {
    const index = new SpatialHash<string>(10);
    index.set('m1', 0, 0);
    expect(index.queryRadius(0, 0, 5)).toContain('m1');
    index.set('m1', 50, 0);
    expect(index.queryRadius(0, 0, 5)).not.toContain('m1');
    expect(index.queryRadius(50, 0, 5)).toContain('m1');
  });

  it('remove drops id from queries', () => {
    const index = new SpatialHash<string>(10);
    index.set('m1', 0, 0);
    index.remove('m1');
    expect(index.queryRadius(0, 0, 10)).toEqual([]);
  });
});
