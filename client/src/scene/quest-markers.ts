import { resolveNpcMarkers, type QuestDefinition, type QuestRuntimeState } from '@nj/game-core';
import { questTitle } from '../quest-catalog';

export type QuestMarkerDisplay = 'none' | 'available' | 'in_progress' | 'completable';

export interface QuestMarkerNpc {
  npcId: number;
  x: number;
  y: number;
  z: number;
}

const MARKER_LABEL: Record<QuestMarkerDisplay, string> = {
  none: '',
  available: '!',
  in_progress: '?',
  completable: '!',
};

export function syncQuestMarkers(params: {
  npcs: QuestMarkerNpc[];
  entries: QuestRuntimeState[];
  defs: QuestDefinition[];
  playerLevel: number;
  container?: HTMLElement;
}): number {
  const root = params.container ?? ensureMarkerRoot();
  root.innerHTML = '';

  const defsById = new Map(params.defs.map((d) => [d.questId, d]));
  const completed = new Set(
    params.entries.filter((e) => e.status === 'completed').map((e) => e.questId)
  );
  let count = 0;

  for (const npc of params.npcs) {
    const kind = resolveNpcMarkers(
      npc.npcId,
      params.entries,
      defsById,
      params.playerLevel,
      completed
    ) as QuestMarkerDisplay;
    if (kind === 'none') continue;
    count++;
    const el = document.createElement('div');
    el.dataset['role'] = 'quest-marker';
    el.dataset['npcId'] = String(npc.npcId);
    el.dataset['markerKind'] = kind;
    el.textContent = MARKER_LABEL[kind];
    el.title = `${questTitle(npc.npcId)} marker`;
    el.style.cssText = [
      'position:absolute',
      'color:#ffd54f',
      'font:bold 18px system-ui,sans-serif',
      'pointer-events:none',
    ].join(';');
    root.appendChild(el);
  }

  return count;
}

function ensureMarkerRoot(): HTMLElement {
  const id = 'quest-markers';
  let root = document.getElementById(id);
  if (!root) {
    root = document.createElement('div');
    root.id = id;
    document.body.appendChild(root);
  }
  return root;
}
