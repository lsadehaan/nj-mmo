import {
  advanceTalk,
  canCompleteQuest,
  canStartQuest,
  collectQuestDropItemIds,
  completeQuest,
  getActiveQuestItemIds,
  grantQuestRewards,
  onDeliver,
  onMobKilled,
  startQuest,
  type QuestDefinition,
  type QuestRuntimeState,
} from '@nj/game-core';
import type { ExperienceCurveRow } from '@nj/game-core';
import type { AppDatabase } from '../db/client';
import {
  isQuestItem,
  saveCharacterQuest,
  type CharacterItemCounts,
} from '../db/character-repository';
import type { PlayerState } from './schema/TownState';
import { QuestEntryState } from './schema/QuestEntryState';

const FIGHTER_CLASS_IDS = new Set([0, 18, 31, 44, 53]);
const MYSTIC_CLASS_IDS = new Set([10, 25, 38, 49]);

export interface QuestDialogButton {
  action: string;
  label: string;
}

export interface QuestDialogPayload {
  questId: number;
  title: string;
  body: string;
  buttons: QuestDialogButton[];
  levelTooLow?: boolean;
  minLevel?: number;
}

export interface QuestRoomContext {
  db: AppDatabase;
  characterId: string;
  player: PlayerState;
  stored: { classId: number; equippedWeaponItemId: number | null };
  questDefs: Map<number, QuestDefinition>;
  questEntries: QuestRuntimeState[];
  playerItems: CharacterItemCounts;
  experienceCurve: ExperienceCurveRow[];
  setItemCount: (itemId: number, count: number) => void;
  getItemCount: (itemId: number) => number;
  persistItems: () => void;
  persistCharacter: () => void;
  syncQuestEntries: () => void;
}

function playerArchetype(classId: number): 'fighter' | 'mystic' {
  if (MYSTIC_CLASS_IDS.has(classId)) return 'mystic';
  return 'fighter';
}

function findEntry(entries: QuestRuntimeState[], questId: number): QuestRuntimeState | undefined {
  return entries.find((e) => e.questId === questId);
}

function completedIds(entries: QuestRuntimeState[]): Set<number> {
  return new Set(entries.filter((e) => e.status === 'completed').map((e) => e.questId));
}

function objectiveText(def: QuestDefinition, state: QuestRuntimeState): string {
  if (state.step >= def.steps.length) return 'Return to quest giver';
  const step = def.steps[state.step];
  return step?.objectives.map((o) => o.description).join('; ') ?? '';
}

export function ensureAutoStartQuests(ctx: QuestRoomContext): void {
  for (const def of ctx.questDefs.values()) {
    if (!def.autoStart) continue;
    if (findEntry(ctx.questEntries, def.questId)) continue;
    const entry = startQuest(def);
    ctx.questEntries.push(entry);
    saveCharacterQuest(ctx.db, ctx.characterId, entry);
  }
  ctx.syncQuestEntries();
}

function pickQuestAtNpc(
  questsAtNpc: { def: QuestDefinition; state?: QuestRuntimeState }[],
  ctx: QuestRoomContext
): { def: QuestDefinition; state?: QuestRuntimeState } | undefined {
  if (questsAtNpc.length === 0) return undefined;
  const done = completedIds(ctx.questEntries);

  const inProgress = questsAtNpc
    .filter(({ state }) => state?.status === 'in_progress')
    .sort((a, b) => a.def.questId - b.def.questId);
  if (inProgress.length > 0) return inProgress[0];

  const canStart = questsAtNpc
    .filter(({ def, state }) => !state && canStartQuest(def, ctx.player.level, done))
    .sort((a, b) => b.def.minLevel - a.def.minLevel || a.def.questId - b.def.questId);
  if (canStart.length > 0) return canStart[0];

  const tooLow = questsAtNpc
    .filter(({ def, state }) => !state && ctx.player.level < def.minLevel)
    .sort((a, b) => a.def.minLevel - b.def.minLevel || a.def.questId - b.def.questId);
  return tooLow[0];
}

export function getQuestEntriesForNpc(
  ctx: QuestRoomContext,
  npcId: number
): { def: QuestDefinition; state?: QuestRuntimeState }[] {
  const done = completedIds(ctx.questEntries);
  const results: { def: QuestDefinition; state?: QuestRuntimeState }[] = [];

  for (const def of ctx.questDefs.values()) {
    const state = findEntry(ctx.questEntries, def.questId);
    if (state?.status === 'completed') continue;

    if (def.stubGiverNpcId === npcId) {
      if (!state && done.has(def.questId)) continue;
      results.push({ def, state });
      continue;
    }

    if (state?.status === 'in_progress' && state.step < def.steps.length) {
      const step = def.steps[state.step];
      const hasObjective = step?.objectives.some(
        (o) => (o.kind === 'TALK' || o.kind === 'DELIVER') && o.npcId === npcId
      );
      if (hasObjective) results.push({ def, state });
    }
  }
  return results;
}

export function buildQuestDialog(
  ctx: QuestRoomContext,
  npcId: number
): QuestDialogPayload | null {
  const questsAtNpc = getQuestEntriesForNpc(ctx, npcId);
  if (questsAtNpc.length === 0) return null;

  const picked = pickQuestAtNpc(questsAtNpc, ctx);
  if (!picked) return null;

  const { def, state } = picked;
  const done = completedIds(ctx.questEntries);

  if (!state) {
    if (!canStartQuest(def, ctx.player.level, done)) {
      return {
        questId: def.questId,
        title: def.name,
        body: `You must be level ${def.minLevel} to accept this quest.`,
        buttons: [],
        levelTooLow: true,
        minLevel: def.minLevel,
      };
    }
    return {
      questId: def.questId,
      title: def.name,
      body: `Accept quest: ${def.name}?`,
      buttons: [{ action: 'accept', label: 'Accept' }],
    };
  }

  if (canCompleteQuest(state, def)) {
    return {
      questId: def.questId,
      title: def.name,
      body: 'You have completed the objectives. Claim your reward.',
      buttons: [{ action: 'complete', label: 'Complete' }],
    };
  }

  const body =
    def.questId === 255 && state.step === 0
      ? 'Welcome! Continue the tutorial to learn combat basics.'
      : objectiveText(def, state);

  const buttons: QuestDialogButton[] = [];
  if (def.questId === 255 && state.step === 0) {
    buttons.push({ action: 'talk', label: 'Continue tutorial' });
  } else if (state.step < def.steps.length) {
    const step = def.steps[state.step];
    const needsTalk = step?.objectives.some((o) => o.kind === 'TALK' && o.npcId === npcId);
    const needsDeliver = step?.objectives.some((o) => o.kind === 'DELIVER' && o.npcId === npcId);
    if (needsTalk) buttons.push({ action: 'talk', label: 'Continue' });
    if (needsDeliver) buttons.push({ action: 'deliver', label: 'Deliver items' });
  }

  return {
    questId: def.questId,
    title: def.name,
    body,
    buttons,
  };
}

export function handleQuestAction(
  ctx: QuestRoomContext,
  npcId: number,
  action: string
): boolean {
  const questsAtNpc = getQuestEntriesForNpc(ctx, npcId);
  if (questsAtNpc.length === 0) return false;

  const picked = pickQuestAtNpc(questsAtNpc, ctx);
  if (!picked) return false;

  const { def } = picked;
  const idx = ctx.questEntries.findIndex((e) => e.questId === def.questId);
  const done = completedIds(ctx.questEntries);

  if (action === 'accept') {
    if (idx >= 0) return false;
    if (!canStartQuest(def, ctx.player.level, done)) return false;
    const entry = startQuest(def);
    ctx.questEntries.push(entry);
    saveCharacterQuest(ctx.db, ctx.characterId, entry);
    ctx.syncQuestEntries();
    return true;
  }

  if (idx < 0) return false;
  const state = ctx.questEntries[idx]!;

  if (action === 'talk') {
    const next = advanceTalk(state, def, npcId);
    if (next === state) return false;
    ctx.questEntries[idx] = next;
    saveCharacterQuest(ctx.db, ctx.characterId, next);
    ctx.syncQuestEntries();
    return true;
  }

  if (action === 'deliver') {
    const next = onDeliver(state, def, npcId, ctx.playerItems);
    if (next === state) return false;
    for (const step of def.steps) {
      for (const obj of step.objectives) {
        if (obj.kind === 'DELIVER' && obj.itemId != null && obj.npcId === npcId) {
          const remaining = (ctx.playerItems[obj.itemId] ?? 0) - obj.count;
          ctx.setItemCount(obj.itemId, Math.max(0, remaining));
        }
      }
    }
    ctx.questEntries[idx] = next;
    saveCharacterQuest(ctx.db, ctx.characterId, next);
    ctx.persistItems();
    ctx.syncQuestEntries();
    return true;
  }

  if (action === 'complete') {
    if (!canCompleteQuest(state, def)) return false;
    const archetype = playerArchetype(ctx.stored.classId);
    const reward = grantQuestRewards(
      def.rewards,
      { level: ctx.player.level, xp: ctx.player.xp, adena: ctx.player.adena },
      ctx.experienceCurve,
      archetype
    );
    ctx.player.level = reward.level;
    ctx.player.xp = reward.xp;
    ctx.player.adena = reward.adena;
    for (const item of reward.items) {
      ctx.setItemCount(item.itemId, ctx.getItemCount(item.itemId) + item.count);
    }
    for (const itemId of getActiveQuestItemIds([def])) {
      if (isQuestItem(ctx.db, itemId)) {
        ctx.setItemCount(itemId, 0);
      }
    }
    const completed = completeQuest(state);
    ctx.questEntries[idx] = completed;
    saveCharacterQuest(ctx.db, ctx.characterId, completed);
    ctx.persistItems();
    ctx.persistCharacter();
    ctx.syncQuestEntries();
    return true;
  }

  return false;
}

export function onMobKilledForQuests(
  ctx: QuestRoomContext,
  mobNpcId: number
): void {
  let changed = false;
  for (let i = 0; i < ctx.questEntries.length; i++) {
    const state = ctx.questEntries[i]!;
    if (state.status !== 'in_progress') continue;
    const def = ctx.questDefs.get(state.questId);
    if (!def) continue;

    const drops = collectQuestDropItemIds(state, def, mobNpcId);
    for (const itemId of drops) {
      ctx.setItemCount(itemId, ctx.getItemCount(itemId) + 1);
      changed = true;
    }

    const next = onMobKilled(state, def, mobNpcId);
    if (next !== state) {
      ctx.questEntries[i] = next;
      saveCharacterQuest(ctx.db, ctx.characterId, next);
      changed = true;
    }
  }
  if (changed) {
    ctx.persistItems();
    ctx.syncQuestEntries();
  }
}

export function syncQuestEntriesToPlayer(
  player: PlayerState,
  entries: QuestRuntimeState[]
): void {
  player.questEntries.clear();
  for (const entry of entries) {
    const schema = new QuestEntryState();
    schema.questId = entry.questId;
    schema.status = entry.status;
    schema.step = entry.step;
    schema.counters.clear();
    for (const c of entry.counters) {
      schema.counters.push(c);
    }
    player.questEntries.push(schema);
  }
}

export function grantDeliveryItemsForQuest(
  db: AppDatabase,
  questDefs: Map<number, QuestDefinition>,
  questId: number,
  setItemCount: (itemId: number, count: number) => void,
  getItemCount: (itemId: number) => number
): void {
  const def = questDefs.get(questId);
  if (!def) return;
  for (const step of def.steps) {
    for (const obj of step.objectives) {
      if (obj.kind === 'DELIVER' && obj.itemId != null && isQuestItem(db, obj.itemId)) {
        if (getItemCount(obj.itemId) < obj.count) {
          setItemCount(obj.itemId, obj.count);
        }
      }
    }
  }
}
