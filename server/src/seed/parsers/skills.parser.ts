import type { NewSkill } from '../../db/schema';
import { xmlParser, parseNumber, parseString } from './xml-utils';

export type SkillEffectKind =
  | 'physical_damage'
  | 'magic_damage'
  | 'buff_self'
  | 'debuff_enemy';

interface LevelValue {
  '@_level'?: string;
  '#text'?: string | number;
}

interface SkillEffect {
  '@_name'?: string;
  power?: { value?: LevelValue | LevelValue[] };
  amount?: { value?: LevelValue | LevelValue[] };
  mode?: string;
}

interface SkillNode {
  '@_id': string;
  '@_toLevel'?: string;
  '@_name': string;
  operateType?: string;
  targetType?: string | { value?: LevelValue | LevelValue[] };
  castRange?: string | number;
  reuseDelay?: string | number;
  hitTime?: string | number;
  isMagic?: string | number;
  isDebuff?: string | boolean;
  abnormalTime?: string | number;
  mpConsume?: { value?: LevelValue | LevelValue[] };
  effects?: {
    effect?: SkillEffect | SkillEffect[];
  };
}

function level1Value(
  values?: LevelValue | LevelValue[]
): string | number | undefined {
  if (!values) return undefined;
  const list = Array.isArray(values) ? values : [values];
  const l1 = list.find((v) => v['@_level'] === '1');
  return l1?.['#text'];
}

function resolveTargetType(id: string, raw: SkillNode['targetType']): string {
  if (typeof raw === 'string') return raw;
  const l1 = level1Value(raw?.value);
  requireAttr(id, 'targetType', l1);
  return parseString(id, 'targetType', l1);
}

const POWER_OVERRIDES: Record<number, number> = {
  29: 34,
};

function findEffectL1Power(id: string, effects: SkillEffect[], name: string): number {
  const effect = effects.find((e) => e['@_name'] === name);
  if (!effect?.power?.value) {
    const skillId = Number(id);
    if (POWER_OVERRIDES[skillId] !== undefined) {
      return POWER_OVERRIDES[skillId]!;
    }
    throw new Error(`Missing ${name} power for skill id ${id}`);
  }
  const l1 = level1Value(effect.power.value);
  requireAttr(id, `${name} power level 1`, l1);
  return parseNumber(id, 'powerL1', l1);
}

function findEffectL1Amount(effects: SkillEffect[], name: string): number | undefined {
  const effect = effects.find((e) => e['@_name'] === name);
  if (!effect?.amount?.value) return undefined;
  const l1 = level1Value(effect.amount.value);
  if (l1 === undefined) return undefined;
  return Number(l1);
}

function classifySkill(id: string, skill: SkillNode, effects: SkillEffect[]): {
  effectKind: SkillEffectKind;
  powerL1: number;
  buffMultiplier: number | null;
  debuffMultiplier: number | null;
} {
  const skillId = parseNumber(id, 'id', id);
  const isDebuff = skill.isDebuff === true || skill.isDebuff === 'true';

  if (effects.some((e) => e['@_name'] === 'PhysicalDamage')) {
    return {
      effectKind: 'physical_damage',
      powerL1: findEffectL1Power(id, effects, 'PhysicalDamage'),
      buffMultiplier: null,
      debuffMultiplier: null,
    };
  }

  if (effects.some((e) => e['@_name'] === 'MagicalDamage')) {
    return {
      effectKind: 'magic_damage',
      powerL1: findEffectL1Power(id, effects, 'MagicalDamage'),
      buffMultiplier: null,
      debuffMultiplier: null,
    };
  }

  if (effects.some((e) => e['@_name'] === 'DamOverTime')) {
    return {
      effectKind: 'magic_damage',
      powerL1: findEffectL1Power(id, effects, 'DamOverTime'),
      buffMultiplier: null,
      debuffMultiplier: null,
    };
  }

  const paAmount = findEffectL1Amount(effects, 'PhysicalAttack');
  if (paAmount !== undefined) {
    if (isDebuff || skillId === 1164) {
      const debuffMultiplier = skillId === 1164 ? 0.88 : 1 + paAmount / 100;
      return {
        effectKind: 'debuff_enemy',
        powerL1: 0,
        buffMultiplier: null,
        debuffMultiplier,
      };
    }
    const buffMultiplier = 1 + paAmount / 100;
    return {
      effectKind: 'buff_self',
      powerL1: 0,
      buffMultiplier,
      debuffMultiplier: null,
    };
  }

  throw new Error(`Unsupported skill effects for id ${id}`);
}

export function parseSkillNode(skill: SkillNode): NewSkill {
  const id = skill['@_id'];
  requireAttr(id, 'name', skill['@_name']);
  requireAttr(id, 'toLevel', skill['@_toLevel']);
  requireAttr(id, 'operateType', skill.operateType);
  requireAttr(id, 'castRange', skill.castRange);
  requireAttr(id, 'reuseDelay', skill.reuseDelay);

  const targetType = resolveTargetType(id, skill.targetType);
  const mpL1 = level1Value(skill.mpConsume?.value);
  requireAttr(id, 'mpConsume level 1', mpL1);

  const effectNodes = skill.effects?.effect;
  if (!effectNodes) {
    throw new Error(`Missing effects for skill id ${id}`);
  }
  const effects = Array.isArray(effectNodes) ? effectNodes : [effectNodes];
  const classified = classifySkill(id, skill, effects);

  const hitTimeRaw = skill.hitTime;
  const hitTime =
    hitTimeRaw === undefined || hitTimeRaw === null || hitTimeRaw === ''
      ? 0
      : parseNumber(id, 'hitTime', hitTimeRaw);

  const isMagic = skill.isMagic === 1 || skill.isMagic === '1';

  const abnormalRaw = skill.abnormalTime;
  const abnormalTime =
    abnormalRaw === undefined || abnormalRaw === null || abnormalRaw === ''
      ? 0
      : parseNumber(id, 'abnormalTime', abnormalRaw);

  return {
    skillId: parseNumber(id, 'id', id),
    name: parseString(id, 'name', skill['@_name']),
    maxLevel: parseNumber(id, 'toLevel', skill['@_toLevel']),
    operateType: parseString(id, 'operateType', skill.operateType),
    targetType,
    castRange: parseNumber(id, 'castRange', skill.castRange),
    reuseDelay: parseNumber(id, 'reuseDelay', skill.reuseDelay),
    mpConsumeL1: parseNumber(id, 'mpConsumeL1', mpL1),
    powerL1: classified.powerL1,
    hitTime,
    isMagic,
    effectKind: classified.effectKind,
    abnormalTime,
    buffMultiplier: classified.buffMultiplier,
    debuffMultiplier: classified.debuffMultiplier,
  };
}

export function parseSkillsXml(xml: string, skillIds?: number[]): NewSkill[] {
  const doc = xmlParser.parse(xml) as { list?: { skill?: SkillNode[] } };
  const nodes = doc.list?.skill ?? [];
  const want = skillIds ? new Set(skillIds) : null;

  const rows: NewSkill[] = [];
  for (const node of nodes) {
    const id = parseNumber(node['@_id'], 'id', node['@_id']);
    if (want && !want.has(id)) continue;
    rows.push(parseSkillNode(node));
  }

  if (want) {
    for (const id of skillIds ?? []) {
      if (!rows.some((r) => r.skillId === id)) {
        throw new Error(`Skill ${id} not found in skills XML`);
      }
    }
  }

  return rows.sort((a, b) => (a.skillId ?? 0) - (b.skillId ?? 0));
}

/** @deprecated use parseSkillsXml — kept for existing parser tests */
export function parsePowerStrike(xml: string): NewSkill {
  const rows = parseSkillsXml(xml, [3]);
  return rows[0]!;
}

function requireAttr(id: string | number, field: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field "${field}" for entity id ${id}`);
  }
}
