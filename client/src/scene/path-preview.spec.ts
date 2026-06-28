import { describe, it, expect } from 'vitest';
import { buildPathPreviewPoints } from './path-preview';

describe('buildPathPreviewPoints', () => {
  it('returns at least two points for path around village building', () => {
    const points = buildPathPreviewPoints(0, 20, 0, -25);
    expect(points.length).toBeGreaterThanOrEqual(2);
  });
});
