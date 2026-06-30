import {
  applyClassLevelUpReward,
  assignPartyDrops,
  calcPartyXpGrants,
  calcPartySpGrants,
  grantXpCapped,
  grantSp,
  applyKarmaRelief,
  awardStatPointOnLevelUp,
  TI_LEVEL_CAP,
  horizontalDistance,
  PARTY_RANGE_WORLD,
  rollDrops,
  type DropRow,
  type ExperienceCurveRow,
  type SeededRng,
  type ClassVitalsRow,
} from '@nj/game-core';
import type { Character } from '../db/schema';
import type { PlayerState } from './schema/TownState';
import type { KillEvent } from './combat-resolver';

export const PARTY_KILL_RANGE = PARTY_RANGE_WORLD;

export interface PartyKillMember {
  sessionId: string;
  player: PlayerState;
  stored: Character;
  inRange: boolean;
}

export interface PartyKillRewardsResult {
  kill: KillEvent;
  dropsBySession: Map<string, { itemId: number; count: number }[]>;
}

export function resolvePartyKillRewards(params: {
  killerSessionId: string;
  mobX: number;
  mobZ: number;
  mobExp: number;
  mobSp: number;
  mobNpcId: number;
  mobId: string;
  members: PartyKillMember[];
  experienceCurve: ExperienceCurveRow[];
  dropRows: DropRow[];
  rng: SeededRng;
  classVitalsByClassId: Map<number, ClassVitalsRow[]>;
}): PartyKillRewardsResult | null {
  const killer = params.members.find((m) => m.sessionId === params.killerSessionId);
  if (!killer) return null;

  const inRangeMembers = params.members.map((m) => ({
    sessionId: m.sessionId,
    level: m.player.level,
    inRange: horizontalDistance(m.player.x, m.player.z, params.mobX, params.mobZ) <= PARTY_KILL_RANGE,
  }));

  const highestLevel = Math.max(...inRangeMembers.filter((m) => m.inRange).map((m) => m.level), 1);
  const xpGrants = calcPartyXpGrants(params.mobExp, inRangeMembers, highestLevel);
  const spGrants = calcPartySpGrants(params.mobSp, inRangeMembers, highestLevel);

  const kill: KillEvent = {
    mobId: params.mobId,
    npcId: params.mobNpcId,
    killerSessionId: params.killerSessionId,
    exp: params.mobExp,
    sp: params.mobSp,
    drops: [],
  };

  if (params.dropRows.length > 0) {
    kill.drops = rollDrops(params.dropRows, params.rng);
  }

  const eligibleForLoot = inRangeMembers.filter((m) => m.inRange).map((m) => m.sessionId);
  const dropsBySession = assignPartyDrops(kill.drops, eligibleForLoot, params.rng);

  for (const member of params.members) {
    const addXp = xpGrants.get(member.sessionId) ?? 0;
    const addSp = spGrants.get(member.sessionId) ?? 0;
    const prevLevel = member.player.level;

    if (addXp > 0 && member.player.level !== TI_LEVEL_CAP) {
      const granted = grantXpCapped(
        member.player.level,
        member.player.xp,
        addXp,
        params.experienceCurve
      );
      member.player.level = granted.level;
      member.player.xp = granted.xp;
      member.stored.level = granted.level;
      member.stored.xp = granted.xp;
    }

    if (addSp > 0) {
      member.player.sp = grantSp(member.player.sp, addSp);
      member.stored.sp = member.player.sp;
    }

    if (member.player.karma < 0 && addXp > 0) {
      member.player.karma = applyKarmaRelief(member.player.karma, addXp);
      member.stored.karma = member.player.karma;
    }

    if (member.player.level > prevLevel) {
      const statAward = awardStatPointOnLevelUp(
        {
          unspentStatPoints: member.player.unspentStatPoints,
          bonusStr: member.player.bonusStr,
          bonusDex: member.player.bonusDex,
          bonusCon: member.player.bonusCon,
          bonusInt: member.player.bonusInt,
          bonusWit: member.player.bonusWit,
          bonusMen: member.player.bonusMen,
        },
        prevLevel,
        member.player.level
      );
      member.player.unspentStatPoints = statAward.unspentStatPoints;
      member.stored.unspentStatPoints = statAward.unspentStatPoints;

      const curve = params.classVitalsByClassId.get(member.player.classId);
      if (curve) {
        const rewarded = applyClassLevelUpReward(
          prevLevel,
          member.player.level,
          {
            maxHp: member.player.maxHp,
            maxMp: member.player.maxMp,
            hp: member.player.hp,
            mp: member.player.mp,
          },
          curve
        );
        member.player.maxHp = rewarded.maxHp;
        member.player.maxMp = rewarded.maxMp;
        member.player.hp = rewarded.hp;
        member.player.mp = rewarded.mp;
        member.stored.maxHp = rewarded.maxHp;
        member.stored.maxMp = rewarded.maxMp;
        member.stored.hp = rewarded.hp;
        member.stored.mp = rewarded.mp;
      }
    }
  }

  return { kill, dropsBySession };
}
