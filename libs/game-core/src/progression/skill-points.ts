import {
  calcPartyXpGrants,
  partyXpBonus,
  type PartyXpMember,
} from '../social/party-xp';

export function grantSp(current: number, amount: number): number {
  return current + amount;
}

export function canAffordSkill(sp: number, levelUpSp: number): boolean {
  return sp >= levelUpSp;
}

export function deductSkillSp(sp: number, levelUpSp: number): number {
  return sp - levelUpSp;
}

export function calcPartySpGrants(
  mobSp: number,
  members: PartyXpMember[],
  highestLevel: number
): Map<string, number> {
  const xpGrants = calcPartyXpGrants(mobSp, members, highestLevel);
  const grants = new Map<string, number>();
  for (const [sessionId, share] of xpGrants.entries()) {
    grants.set(sessionId, share);
  }
  return grants;
}

export { partyXpBonus };
