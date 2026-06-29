import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { items, questObjectives, questRewards, quests } from '../../db/schema';
import { fixturePath } from '../paths';
import { parseQuestsJson } from '../parsers/quests.parser';

export const TI_QUEST_IDS = [
  255, 101, 104, 105, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 106, 107, 108,
] as const;

export function seedQuests(db: AppDatabase, dataDir?: string): number {
  const path = dataDir
    ? join(dataDir, 'quests', 'quests.json')
    : fixturePath('quests/quests.json');
  const raw = readFileSync(path, 'utf-8');
  const fixture = parseQuestsJson(raw);

  for (const item of fixture.questItems) {
    db.insert(items)
      .values({
        itemId: item.itemId,
        name: item.name,
        type: item.type,
        isQuestItem: item.isQuestItem,
      })
      .onConflictDoUpdate({
        target: items.itemId,
        set: {
          name: item.name,
          type: item.type,
          isQuestItem: item.isQuestItem,
        },
      })
      .run();
  }

  for (const quest of fixture.quests) {
    db.insert(quests)
      .values({
        questId: quest.questId,
        name: quest.name,
        minLevel: quest.minLevel,
        stubGiverNpcId: quest.stubGiverNpcId,
        autoStart: quest.autoStart ?? false,
      })
      .run();

    for (let stepIndex = 0; stepIndex < quest.steps.length; stepIndex++) {
      const step = quest.steps[stepIndex]!;
      for (let objectiveIndex = 0; objectiveIndex < step.objectives.length; objectiveIndex++) {
        const obj = step.objectives[objectiveIndex]!;
        db.insert(questObjectives)
          .values({
            questId: quest.questId,
            stepIndex,
            objectiveIndex,
            kind: obj.kind,
            mobNpcId: obj.mobNpcId ?? null,
            npcId: obj.npcId ?? null,
            itemId: obj.itemId ?? null,
            count: obj.count,
            description: obj.description,
          })
          .run();
      }
    }

    for (const reward of quest.rewards) {
      db.insert(questRewards)
        .values({
          questId: quest.questId,
          xp: reward.xp ?? 0,
          adena: reward.adena ?? 0,
          itemId: reward.itemId ?? null,
          itemCount: reward.itemCount ?? 0,
          rewardClass: reward.rewardClass ?? null,
        })
        .run();
    }
  }

  return fixture.quests.length;
}
