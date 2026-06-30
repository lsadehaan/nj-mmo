import { describe, it, expect, beforeEach } from 'vitest';
import { mountWorldMap, renderWorldMap } from './world-map';

describe('world-map', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('UI28-44: world map shows 6 zone labels', () => {
    mountWorldMap();
    renderWorldMap(true);
    expect(document.querySelectorAll('[data-role="zone-label"]').length).toBe(6);
  });
});
