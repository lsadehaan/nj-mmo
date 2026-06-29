import { grantXp, type ExperienceCurveRow } from '../experience';
import type { QuestRewardDef } from './quest-types';

export interface QuestRewardPlayer {
  level: number;
  xp: number;
  adena: number;
}

export interface QuestRewardResult {
  level: number;
  xp: number;
  adena: number;
  items: { itemId: number; count: number }[];
}

export function resolveQuestRewards(
  rewards: QuestRewardDef[],
  player: QuestRewardPlayer,
  curve: ExperienceCurveRow[],
  archetype: 'fighter' | 'mystic'
): QuestRewardResult {
  const applicable = rewards.filter(
    (r) => !r.rewardClass || r.rewardClass === archetype
  );

  let level = player.level;
  let xp = player.xp;
  let adena = player.adena;
  const items: { itemId: number; count: number }[] = [];

  for (const reward of applicable) {
    if (reward.xp && reward.xp > 0) {
      const granted = grantXp(level, xp, reward.xp, curve);
      level = granted.level;
      xp = granted.xp;
    }
    if (reward.adena && reward.adena > 0) {
      adena += reward.adena;
    }
    if (reward.itemId && reward.count && reward.count > 0) {
      items.push({ itemId: reward.itemId, count: reward.count });
    }
  }

  return { level, xp, adena, items };
}

export function grantQuestRewards(
  rewards: QuestRewardDef[],
  player: QuestRewardPlayer,
  curve: ExperienceCurveRow[],
  archetype: 'fighter' | 'mystic'
): QuestRewardResult {
  return resolveQuestRewards(rewards, player, curve, archetype);
}
