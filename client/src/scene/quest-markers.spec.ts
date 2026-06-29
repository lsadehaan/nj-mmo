import { describe, it, expect, beforeEach } from 'vitest';
import type { QuestDefinition } from '@nj/game-core';
import { syncQuestMarkers } from './quest-markers';

const quest255: QuestDefinition = {
  questId: 255,
  name: 'Tutorial',
  minLevel: 1,
  stubGiverNpcId: 30006,
  autoStart: true,
  steps: [{ objectives: [{ kind: 'TALK', npcId: 30006, count: 1, description: 'Talk' }] }],
  rewards: [],
};

describe('quest-markers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // QUEST21-48
  it('shows marker for Roxxy when tutorial available', () => {
    const count = syncQuestMarkers({
      npcs: [{ npcId: 30006, x: 0, y: 0, z: 0 }],
      entries: [],
      defs: [quest255],
      playerLevel: 1,
    });
    expect(count).toBe(1);
    const marker = document.querySelector('[data-npc-id="30006"]');
    expect(marker?.textContent).toBe('!');
  });

  it('hides marker when none resolved', () => {
    const count = syncQuestMarkers({
      npcs: [{ npcId: 30001, x: 0, y: 0, z: 0 }],
      entries: [],
      defs: [quest255],
      playerLevel: 1,
    });
    expect(count).toBe(0);
  });

  it('marks in_progress with question mark', () => {
    const count = syncQuestMarkers({
      npcs: [{ npcId: 30006, x: 0, y: 0, z: 0 }],
      entries: [{ questId: 255, status: 'in_progress', step: 0, counters: [0] }],
      defs: [quest255],
      playerLevel: 1,
    });
    expect(count).toBe(1);
    expect(document.querySelector('[data-marker-kind="in_progress"]')?.textContent).toBe('?');
  });
});
