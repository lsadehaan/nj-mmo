export type QuestObjectiveKind =
  | 'TALK'
  | 'KILL'
  | 'KILL_COUNT'
  | 'COLLECT'
  | 'DELIVER';

export type QuestStatus = 'not_started' | 'in_progress' | 'completed';

export interface QuestObjectiveDef {
  kind: QuestObjectiveKind;
  npcId?: number;
  mobNpcId?: number;
  itemId?: number;
  count: number;
  description: string;
}

export interface QuestStepDef {
  objectives: QuestObjectiveDef[];
}

export interface QuestRewardDef {
  xp?: number;
  adena?: number;
  itemId?: number;
  count?: number;
  rewardClass?: 'fighter' | 'mystic';
}

export interface QuestDefinition {
  questId: number;
  name: string;
  minLevel: number;
  stubGiverNpcId: number;
  autoStart?: boolean;
  steps: QuestStepDef[];
  rewards: QuestRewardDef[];
}

export interface QuestRuntimeState {
  questId: number;
  status: 'in_progress' | 'completed';
  step: number;
  counters: number[];
}

export type QuestMarkerKind = 'none' | 'available' | 'in_progress' | 'completable';

export type CharacterItemCounts = Record<number, number>;
