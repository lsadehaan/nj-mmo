import { describe, it, expect, beforeEach } from 'vitest';
import { mountMinimap, renderMinimap } from './minimap';
import { normalizeWorldToMinimap } from './minimap-zones';

describe('minimap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('UI28-41: minimap visible with player dot', () => {
    mountMinimap();
    renderMinimap({ playerX: 0, playerZ: 0, zoneDisplayName: 'Village' });
    expect(document.getElementById('minimap')).not.toBeNull();
    expect(document.querySelector('[data-role="player-dot"]')).not.toBeNull();
  });

  it('UI28-42: origin maps to center', () => {
    const { leftPx, topPx } = normalizeWorldToMinimap(0, 0, 120);
    expect(leftPx).toBeCloseTo(60, 0);
    expect(topPx).toBeCloseTo(60, 0);
  });

  it('UI28-43: zone label', () => {
    renderMinimap({ playerX: 0, playerZ: 0, zoneDisplayName: 'Talking Island Village' });
    expect(document.querySelector('[data-role="minimap-zone-label"]')?.textContent).toBe(
      'Talking Island Village'
    );
  });

  it('UI28-45: party dots', () => {
    renderMinimap({
      playerX: 0,
      playerZ: 0,
      zoneDisplayName: 'Village',
      partyPositions: [{ sessionId: 'p2', x: 10, z: 10 }],
    });
    expect(document.querySelectorAll('[data-role="party-dot"]').length).toBe(1);
  });
});
