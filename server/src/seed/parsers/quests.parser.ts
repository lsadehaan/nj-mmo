export type QuestObjectiveKind =
  | 'TALK'
  | 'KILL'
  | 'KILL_COUNT'
  | 'COLLECT'
  | 'DELIVER';

export interface QuestObjectiveFixture {
  kind: QuestObjectiveKind;
  npcId?: number;
  mobNpcId?: number;
  itemId?: number;
  count: number;
  description: string;
}

export interface QuestStepFixture {
  objectives: QuestObjectiveFixture[];
}

export interface QuestRewardFixture {
  xp?: number;
  adena?: number;
  itemId?: number;
  itemCount?: number;
  rewardClass?: 'fighter' | 'mystic';
}

export interface QuestFixture {
  questId: number;
  name: string;
  minLevel: number;
  stubGiverNpcId: number;
  autoStart?: boolean;
  steps: QuestStepFixture[];
  rewards: QuestRewardFixture[];
}

export interface QuestItemFixture {
  itemId: number;
  name: string;
  type: string;
  isQuestItem: boolean;
}

export interface QuestsFixtureFile {
  quests: QuestFixture[];
  questItems: QuestItemFixture[];
}

export function parseQuestsJson(raw: string): QuestsFixtureFile {
  const data = JSON.parse(raw) as QuestsFixtureFile;
  if (!Array.isArray(data.quests) || data.quests.length === 0) {
    throw new Error('quests fixture missing quests array');
  }
  return data;
}
