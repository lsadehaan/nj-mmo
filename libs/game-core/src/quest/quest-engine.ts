import type {
  CharacterItemCounts,
  QuestDefinition,
  QuestObjectiveDef,
  QuestRuntimeState,
} from './quest-types';

function cloneState(state: QuestRuntimeState): QuestRuntimeState {
  return { ...state, counters: [...state.counters] };
}

function currentObjectives(def: QuestDefinition, state: QuestRuntimeState): QuestObjectiveDef[] {
  if (state.step >= def.steps.length) return [];
  return def.steps[state.step]!.objectives;
}

function initCounters(def: QuestDefinition, step: number): number[] {
  const objectives = def.steps[step]?.objectives ?? [];
  return objectives.map(() => 0);
}

function objectiveMet(
  obj: QuestObjectiveDef,
  counter: number,
  inventory: CharacterItemCounts
): boolean {
  if (obj.kind === 'DELIVER') {
    return (inventory[obj.itemId!] ?? 0) >= obj.count;
  }
  return counter >= obj.count;
}

function allObjectivesMet(
  def: QuestDefinition,
  state: QuestRuntimeState,
  inventory: CharacterItemCounts = {}
): boolean {
  const objectives = currentObjectives(def, state);
  return objectives.every((obj, i) => objectiveMet(obj, state.counters[i] ?? 0, inventory));
}

function advanceStepIfComplete(
  state: QuestRuntimeState,
  def: QuestDefinition,
  inventory: CharacterItemCounts = {}
): QuestRuntimeState {
  if (!allObjectivesMet(def, state, inventory)) {
    return state;
  }
  const nextStep = state.step + 1;
  if (nextStep >= def.steps.length) {
    return { ...state, step: nextStep, counters: [] };
  }
  return { ...state, step: nextStep, counters: initCounters(def, nextStep) };
}

export function canStartQuest(
  def: QuestDefinition,
  playerLevel: number,
  completedIds: ReadonlySet<number>
): boolean {
  if (completedIds.has(def.questId)) return false;
  return playerLevel >= def.minLevel;
}

export function startQuest(def: QuestDefinition): QuestRuntimeState {
  return {
    questId: def.questId,
    status: 'in_progress',
    step: 0,
    counters: initCounters(def, 0),
  };
}

export function isQuestReadyToComplete(
  state: QuestRuntimeState,
  def: QuestDefinition,
  inventory: CharacterItemCounts = {}
): boolean {
  if (state.status !== 'in_progress') return false;
  if (state.step < def.steps.length) return false;
  return allObjectivesMet(
    def,
    { ...state, step: def.steps.length - 1, counters: state.counters },
    inventory
  );
}

export function canCompleteQuest(
  state: QuestRuntimeState,
  def: QuestDefinition,
  inventory: CharacterItemCounts = {}
): boolean {
  return state.status === 'in_progress' && state.step >= def.steps.length;
}

export function advanceTalk(
  state: QuestRuntimeState,
  def: QuestDefinition,
  npcId: number
): QuestRuntimeState {
  if (state.status !== 'in_progress') return state;
  const objectives = currentObjectives(def, state);
  let next = cloneState(state);
  let changed = false;

  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i]!;
    if (obj.kind === 'TALK' && obj.npcId === npcId && next.counters[i]! < obj.count) {
      next.counters[i] = obj.count;
      changed = true;
    }
  }

  if (!changed) return state;
  next = advanceStepIfComplete(next, def);
  return next;
}

export function onMobKilled(
  state: QuestRuntimeState,
  def: QuestDefinition,
  mobNpcId: number
): QuestRuntimeState {
  if (state.status !== 'in_progress') return state;
  const objectives = currentObjectives(def, state);
  let next = cloneState(state);
  let changed = false;

  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i]!;
    if (
      (obj.kind === 'KILL' || obj.kind === 'KILL_COUNT' || obj.kind === 'COLLECT') &&
      obj.mobNpcId === mobNpcId &&
      next.counters[i]! < obj.count
    ) {
      next.counters[i] = Math.min(obj.count, next.counters[i]! + 1);
      changed = true;
    }
  }

  if (!changed) return state;
  next = advanceStepIfComplete(next, def);
  return next;
}

export function onDeliver(
  state: QuestRuntimeState,
  def: QuestDefinition,
  npcId: number,
  inventory: CharacterItemCounts
): QuestRuntimeState {
  if (state.status !== 'in_progress') return state;
  const objectives = currentObjectives(def, state);
  let next = cloneState(state);
  let changed = false;

  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i]!;
    if (
      obj.kind === 'DELIVER' &&
      obj.npcId === npcId &&
      (inventory[obj.itemId!] ?? 0) >= obj.count &&
      next.counters[i]! < obj.count
    ) {
      next.counters[i] = obj.count;
      changed = true;
    }
  }

  if (!changed) return state;
  next = advanceStepIfComplete(next, def, inventory);
  return next;
}

export function completeQuest(state: QuestRuntimeState): QuestRuntimeState {
  if (state.status !== 'in_progress') return state;
  return { ...state, status: 'completed', counters: [] };
}

export function hasQuestItem(
  inventory: CharacterItemCounts,
  itemId: number,
  count = 1
): boolean {
  return (inventory[itemId] ?? 0) >= count;
}

export function stripQuestItems(
  inventory: CharacterItemCounts,
  questItemIds: ReadonlySet<number>
): CharacterItemCounts {
  const next = { ...inventory };
  for (const itemId of questItemIds) {
    delete next[itemId];
  }
  return next;
}

export function getActiveQuestItemIds(defs: QuestDefinition[]): Set<number> {
  const ids = new Set<number>();
  for (const def of defs) {
    for (const step of def.steps) {
      for (const obj of step.objectives) {
        if (obj.itemId != null) ids.add(obj.itemId);
      }
    }
  }
  return ids;
}

export function collectQuestDropItemIds(
  state: QuestRuntimeState,
  def: QuestDefinition,
  mobNpcId: number
): number[] {
  if (state.status !== 'in_progress') return [];
  const objectives = currentObjectives(def, state);
  const drops: number[] = [];
  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i]!;
    if (
      obj.kind === 'COLLECT' &&
      obj.mobNpcId === mobNpcId &&
      obj.itemId != null &&
      (state.counters[i] ?? 0) < obj.count
    ) {
      drops.push(obj.itemId);
    }
  }
  return drops;
}
