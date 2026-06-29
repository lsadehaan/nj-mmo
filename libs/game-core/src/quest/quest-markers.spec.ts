import { describe, it, expect } from 'vitest';
import { resolveNpcMarkers, resolveQuestMarker } from './quest-markers';
import type { QuestDefinition } from './quest-types';

const quest105: QuestDefinition = {
  questId: 105,
  name: 'Skirmish With Orcs',
  minLevel: 10,
  stubGiverNpcId: 30026,
  steps: [
    {
      objectives: [
        { kind: 'KILL_COUNT', mobNpcId: 20130, count: 10, description: 'Kill 10 Orc Soldiers' },
      ],
    },
    {
      objectives: [{ kind: 'TALK', npcId: 30026, count: 1, description: 'Report to Bitz' }],
    },
  ],
  rewards: [],
};

const defs = new Map([[105, quest105]]);

describe('quest-markers', () => {
  // QUEST21-44
  it('shows available at Bitz when quest 105 not started', () => {
    expect(
      resolveQuestMarker(30026, undefined, quest105, 10, new Set())
    ).toBe('available');
  });

  // QUEST21-45
  it('shows in_progress at Bitz during kill step', () => {
    expect(
      resolveQuestMarker(
        30026,
        { questId: 105, status: 'in_progress', step: 0, counters: [3] },
        quest105,
        10,
        new Set()
      )
    ).toBe('in_progress');
  });

  // QUEST21-46
  it('shows completable at Bitz when ready to turn in', () => {
    expect(
      resolveQuestMarker(
        30026,
        { questId: 105, status: 'in_progress', step: 2, counters: [] },
        quest105,
        10,
        new Set()
      )
    ).toBe('completable');
  });

  // QUEST21-47
  it('shows none for NPC with no quest involvement', () => {
    expect(resolveNpcMarkers(30001, [], defs, 10, new Set())).toBe('none');
  });

  it('prioritizes completable over available', () => {
    const questB: QuestDefinition = {
      questId: 107,
      name: 'Other',
      minLevel: 10,
      stubGiverNpcId: 30026,
      steps: [{ objectives: [{ kind: 'TALK', npcId: 30026, count: 1, description: 'x' }] }],
      rewards: [],
    };
    const map = new Map([
      [105, quest105],
      [107, questB],
    ]);
    const marker = resolveNpcMarkers(
      30026,
      [
        { questId: 105, status: 'in_progress', step: 2, counters: [] },
      ],
      map,
      10,
      new Set()
    );
    expect(marker).toBe('completable');
  });
});
