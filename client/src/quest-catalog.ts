/** Minimal TI quest titles for client log + markers (mirrors seed). */
export const TI_QUEST_TITLES: Record<number, string> = {
  255: 'Tutorial',
  101: 'Sword of Solidarity',
  104: 'Spirit of Mirrors',
  105: 'Skirmish With Orcs',
  151: 'Cure For Fever',
  152: 'Shards of Golem',
  153: 'Deliver Goods',
  154: 'Sacrifice to the Sea',
  155: 'Find Sir Windawood',
  156: 'Millennium Love',
  157: 'Recover Smuggled Goods',
  158: 'Seed of Evil',
  159: 'Protect the Water Source',
  160: "Nerupa's Request",
  106: 'Forgotten Truth',
  107: 'Merciless Punishment',
  108: 'Jumble Tumble Diamond Fuss',
};

export const TI_QUEST_OBJECTIVES: Record<number, string[]> = {
  255: ['Talk to Roxxy', 'Kill a Gremlin', 'Return to Roxxy'],
  105: ['Kill 10 Orc Soldiers', 'Report to Bitz'],
};

export function questTitle(questId: number): string {
  return TI_QUEST_TITLES[questId] ?? `Quest ${questId}`;
}

export function questObjectiveText(questId: number, step: number): string {
  const lines = TI_QUEST_OBJECTIVES[questId];
  if (lines && step < lines.length) return lines[step]!;
  return 'Continue your quest';
}
