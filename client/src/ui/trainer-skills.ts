import { BITZ_NPC_ID, GWINTER_NPC_ID, BAULRO_NPC_ID } from './npc-dialog';

/** MVP class-tree subset mirrored from Phase 20 spec (SKILL20-R09). */
const FIGHTER_LEARN_SKILLS: Record<number, number[]> = {
  0: [3],
  18: [3],
  31: [3],
  53: [3],
  44: [29],
};

const MYSTIC_BUFF_SKILLS: Record<number, number[]> = {
  10: [1068],
  25: [1068],
  38: [1068],
  49: [1068],
};

const BAULRO_DEBUFF_SKILLS = [1164];

export function getLearnableSkillIds(
  npcId: number,
  classId: number,
  knownSkillIds: number[]
): number[] {
  const known = new Set(knownSkillIds);
  const offers: number[] = [];

  if (npcId === BITZ_NPC_ID || npcId === GWINTER_NPC_ID) {
    for (const skillId of FIGHTER_LEARN_SKILLS[classId] ?? []) {
      if (!known.has(skillId)) offers.push(skillId);
    }
    return offers;
  }

  if (npcId === BAULRO_NPC_ID) {
    for (const skillId of MYSTIC_BUFF_SKILLS[classId] ?? []) {
      if (!known.has(skillId)) offers.push(skillId);
    }
    for (const skillId of BAULRO_DEBUFF_SKILLS) {
      if (!known.has(skillId)) offers.push(skillId);
    }
    return offers;
  }

  return offers;
}

export const SKILL_EFFECT_NAMES: Record<number, string> = {
  1068: 'Might',
  1164: 'Curse Weakness',
};
