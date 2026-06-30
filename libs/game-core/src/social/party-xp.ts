/** L2J Classic Party.BONUS_EXP_SP — index = members in range (1-based). */
export const PARTY_XP_BONUS_TABLE = [
  1.0, 1.3, 1.35, 1.4, 1.55, 1.6, 1.7, 1.8, 2.0,
] as const;

export const PARTY_XP_CUTOFF_LEVEL_GAP = 20;
export const PARTY_RANGE_WORLD = 15;

export interface PartyXpMember {
  sessionId: string;
  level: number;
  inRange: boolean;
}

export function partyXpBonus(memberCountInRange: number): number {
  const idx = Math.max(1, Math.min(memberCountInRange, PARTY_XP_BONUS_TABLE.length));
  return PARTY_XP_BONUS_TABLE[idx - 1]!;
}

export function calcPartyXpGrants(
  mobExp: number,
  members: PartyXpMember[],
  highestLevel: number
): Map<string, number> {
  const inRange = members.filter((m) => m.inRange);
  const grants = new Map<string, number>();

  if (inRange.length === 0) return grants;

  const bonus = partyXpBonus(inRange.length);
  const pool = mobExp * bonus;
  const levelSqSum = inRange.reduce((sum, m) => sum + m.level * m.level, 0);

  for (const member of inRange) {
    if (highestLevel - member.level > PARTY_XP_CUTOFF_LEVEL_GAP) {
      grants.set(member.sessionId, 0);
      continue;
    }
    const share = levelSqSum > 0 ? Math.floor((pool * member.level * member.level) / levelSqSum) : 0;
    grants.set(member.sessionId, share);
  }

  for (const member of members.filter((m) => !m.inRange)) {
    grants.set(member.sessionId, 0);
  }

  return grants;
}
