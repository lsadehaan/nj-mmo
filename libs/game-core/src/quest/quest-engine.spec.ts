import { describe, it, expect } from 'vitest';
import {
  advanceTalk,
  canStartQuest,
  completeQuest,
  hasQuestItem,
  onDeliver,
  onMobKilled,
  startQuest,
  stripQuestItems,
} from './quest-engine';
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
  rewards: [{ xp: 27772, itemId: 728, count: 1 }],
};

const collectDeliverQuest: QuestDefinition = {
  questId: 152,
  name: 'Shards',
  minLevel: 10,
  stubGiverNpcId: 30027,
  steps: [
    {
      objectives: [
        { kind: 'COLLECT', mobNpcId: 20016, itemId: 1012, count: 1, description: 'Shard' },
      ],
    },
    {
      objectives: [
        { kind: 'DELIVER', npcId: 30027, itemId: 1012, count: 1, description: 'Deliver' },
      ],
    },
  ],
  rewards: [],
};

describe('quest-engine', () => {
  // QUEST21-01
  it('startQuest sets in_progress at step 0', () => {
    const state = startQuest(quest105);
    expect(state).toEqual({
      questId: 105,
      status: 'in_progress',
      step: 0,
      counters: [0],
    });
  });

  // QUEST21-02
  it('advanceTalk advances TALK objective at giver npcId', () => {
    const talkQuest: QuestDefinition = {
      ...quest105,
      steps: [{ objectives: [{ kind: 'TALK', npcId: 30006, count: 1, description: 'Talk' }] }],
    };
    let state = startQuest(talkQuest);
    state = advanceTalk(state, talkQuest, 30006);
    expect(state.step).toBe(1);
  });

  // QUEST21-03
  it('KILL_COUNT partial credit leaves step incomplete at 9 kills', () => {
    let state = startQuest(quest105);
    for (let i = 0; i < 9; i++) {
      state = onMobKilled(state, quest105, 20130);
    }
    expect(state.counters[0]).toBe(9);
    expect(state.step).toBe(0);
  });

  // QUEST21-04
  it('KILL_COUNT 10th kill advances step', () => {
    let state = startQuest(quest105);
    for (let i = 0; i < 10; i++) {
      state = onMobKilled(state, quest105, 20130);
    }
    expect(state.step).toBe(1);
    expect(state.counters[0]).toBe(0);
  });

  // QUEST21-05
  it('DELIVER completes when inventory has quest item', () => {
    let state = startQuest(collectDeliverQuest);
    state = { ...state, step: 1, counters: [0] };
    state = onDeliver(state, collectDeliverQuest, 30027, { 1012: 1 });
    expect(state.step).toBe(2);
  });

  // QUEST21-06
  it('stripQuestItems removes quest-only inventory rows', () => {
    const next = stripQuestItems({ 1012: 3, 1060: 5 }, new Set([1012]));
    expect(next).toEqual({ 1060: 5 });
    expect(hasQuestItem({ 1012: 1 }, 1012)).toBe(true);
  });

  // QUEST21-08
  it('canStartQuest false when below minLevel', () => {
    expect(canStartQuest(quest105, 9, new Set())).toBe(false);
    expect(canStartQuest(quest105, 10, new Set())).toBe(true);
  });

  // QUEST21-09
  it('duplicate talk for same transition is idempotent', () => {
    let state = startQuest({
      ...quest105,
      steps: [{ objectives: [{ kind: 'TALK', npcId: 30026, count: 1, description: 'Talk' }] }],
    });
    const afterFirst = advanceTalk(state, quest105, 30026);
    const afterSecond = advanceTalk(afterFirst, quest105, 30026);
    expect(afterSecond).toEqual(afterFirst);
  });

  it('completeQuest marks completed', () => {
    const state = completeQuest({
      questId: 105,
      status: 'in_progress',
      step: 2,
      counters: [],
    });
    expect(state.status).toBe('completed');
  });
});
