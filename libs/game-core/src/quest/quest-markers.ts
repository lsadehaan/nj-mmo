import type { QuestDefinition, QuestMarkerKind, QuestRuntimeState } from './quest-types';
import { canStartQuest } from './quest-engine';

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

function entry(
  questId: number,
  status: QuestRuntimeState['status'],
  step: number,
  counters: number[] = []
): QuestRuntimeState {
  return { questId, status, step, counters };
}

export function resolveQuestMarker(
  npcId: number,
  questEntry: QuestRuntimeState | undefined,
  def: QuestDefinition,
  playerLevel: number,
  completedIds: ReadonlySet<number>
): QuestMarkerKind {
  if (questEntry?.status === 'completed') return 'none';

  if (!questEntry) {
    if (def.stubGiverNpcId === npcId && canStartQuest(def, playerLevel, completedIds)) {
      return 'available';
    }
    return 'none';
  }

  if (questEntry.status !== 'in_progress') return 'none';

  if (questEntry.step >= def.steps.length) {
    return def.stubGiverNpcId === npcId ? 'completable' : 'none';
  }

  const step = def.steps[questEntry.step];
  if (!step) return 'none';

  const involvesNpc = step.objectives.some(
    (o) => (o.kind === 'TALK' || o.kind === 'DELIVER') && o.npcId === npcId
  );
  if (involvesNpc) return 'in_progress';

  if (def.stubGiverNpcId === npcId) return 'in_progress';

  return 'none';
}

const MARKER_PRIORITY: Record<QuestMarkerKind, number> = {
  none: 0,
  in_progress: 1,
  available: 2,
  completable: 3,
};

export function resolveNpcMarkers(
  npcId: number,
  entries: QuestRuntimeState[],
  defsById: Map<number, QuestDefinition>,
  playerLevel: number,
  completedIds: ReadonlySet<number>
): QuestMarkerKind {
  let best: QuestMarkerKind = 'none';
  for (const def of defsById.values()) {
    const questEntry = entries.find((e) => e.questId === def.questId);
    const marker = resolveQuestMarker(npcId, questEntry, def, playerLevel, completedIds);
    if (MARKER_PRIORITY[marker] > MARKER_PRIORITY[best]) {
      best = marker;
    }
  }
  return best;
}
