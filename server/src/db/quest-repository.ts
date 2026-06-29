import { eq } from 'drizzle-orm';
import type { AppDatabase } from './client';
import {
  questObjectives,
  questRewards,
  quests,
  items,
  type QuestObjective,
  type QuestReward,
} from './schema';
import type { QuestDefinition, QuestObjectiveDef, QuestRewardDef } from '@nj/game-core';

export function loadQuestDefinitions(db: AppDatabase): Map<number, QuestDefinition> {
  const defs = new Map<number, QuestDefinition>();
  const questRows = db.select().from(quests).all();

  for (const row of questRows) {
    const objectiveRows = db
      .select()
      .from(questObjectives)
      .where(eq(questObjectives.questId, row.questId))
      .all()
      .sort((a, b) => a.stepIndex - b.stepIndex || a.objectiveIndex - b.objectiveIndex);

    const rewardRows = db
      .select()
      .from(questRewards)
      .where(eq(questRewards.questId, row.questId))
      .all();

    defs.set(row.questId, mapQuestRow(row, objectiveRows, rewardRows));
  }

  return defs;
}

function mapQuestRow(
  row: { questId: number; name: string; minLevel: number; stubGiverNpcId: number; autoStart: boolean },
  objectiveRows: QuestObjective[],
  rewardRows: QuestReward[]
): QuestDefinition {
  const stepsByIndex = new Map<number, QuestObjectiveDef[]>();
  for (const obj of objectiveRows) {
    const list = stepsByIndex.get(obj.stepIndex) ?? [];
    list.push({
      kind: obj.kind as QuestObjectiveDef['kind'],
      npcId: obj.npcId ?? undefined,
      mobNpcId: obj.mobNpcId ?? undefined,
      itemId: obj.itemId ?? undefined,
      count: obj.count,
      description: obj.description,
    });
    stepsByIndex.set(obj.stepIndex, list);
  }

  const steps = [...stepsByIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, objectives]) => ({ objectives }));

  const rewards: QuestRewardDef[] = rewardRows.map((r) => ({
    xp: r.xp || undefined,
    adena: r.adena || undefined,
    itemId: r.itemId ?? undefined,
    count: r.itemCount || undefined,
    rewardClass: (r.rewardClass as QuestRewardDef['rewardClass']) ?? undefined,
  }));

  return {
    questId: row.questId,
    name: row.name,
    minLevel: row.minLevel,
    stubGiverNpcId: row.stubGiverNpcId,
    autoStart: row.autoStart,
    steps,
    rewards,
  };
}

export function loadQuestItemFlags(db: AppDatabase): Map<number, boolean> {
  const map = new Map<number, boolean>();
  for (const row of db.select().from(items).all()) {
    map.set(row.itemId, row.isQuestItem);
  }
  return map;
}
