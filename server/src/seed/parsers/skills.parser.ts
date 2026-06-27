import type { NewSkill } from '../../db/schema';
import { xmlParser, parseNumber, parseString } from './xml-utils';

interface SkillNode {
  '@_id': string;
  '@_toLevel'?: string;
  '@_name': string;
  operateType?: string;
  targetType?: string;
  castRange?: string | number;
  reuseDelay?: string | number;
  mpConsume?: { value?: MpValue | MpValue[] };
  effects?: {
    effect?: PhysicalDamageEffect | PhysicalDamageEffect[];
  };
}

interface PhysicalDamageEffect {
  '@_name'?: string;
  power?: { value?: MpValue | MpValue[] };
}

interface MpValue {
  '@_level'?: string;
  '#text'?: string | number;
}

export function parsePowerStrike(xml: string): NewSkill {
  const doc = xmlParser.parse(xml) as { list?: { skill?: SkillNode[] } };
  const nodes = doc.list?.skill ?? [];
  const skill = nodes.find((s) => s['@_id'] === '3');

  if (!skill) {
    throw new Error('Power Strike skill id 3 not found in XML');
  }

  const id = skill['@_id'];
  requireAttr(id, 'name', skill['@_name']);
  requireAttr(id, 'toLevel', skill['@_toLevel']);
  requireAttr(id, 'operateType', skill.operateType);
  requireAttr(id, 'targetType', skill.targetType);
  requireAttr(id, 'castRange', skill.castRange);
  requireAttr(id, 'reuseDelay', skill.reuseDelay);

  const mpL1 = findMpConsumeL1(id, skill.mpConsume);
  requireAttr(id, 'mpConsume level 1', mpL1);

  const powerL1 = findPhysicalDamagePowerL1(id, skill.effects);
  requireAttr(id, 'PhysicalDamage power level 1', powerL1);

  return {
    skillId: parseNumber(id, 'id', id),
    name: parseString(id, 'name', skill['@_name']),
    maxLevel: parseNumber(id, 'toLevel', skill['@_toLevel']),
    operateType: parseString(id, 'operateType', skill.operateType),
    targetType: parseString(id, 'targetType', skill.targetType),
    castRange: parseNumber(id, 'castRange', skill.castRange),
    reuseDelay: parseNumber(id, 'reuseDelay', skill.reuseDelay),
    mpConsumeL1: parseNumber(id, 'mpConsumeL1', mpL1),
    powerL1: parseNumber(id, 'powerL1', powerL1),
  };
}

function findMpConsumeL1(
  id: string,
  mpConsume?: SkillNode['mpConsume']
): string | number | undefined {
  const values = mpConsume?.value;
  if (!values) return undefined;
  const list = Array.isArray(values) ? values : [values];
  const l1 = list.find((v) => v['@_level'] === '1');
  return l1?.['#text'];
}

function findPhysicalDamagePowerL1(
  id: string,
  effects?: SkillNode['effects']
): string | number | undefined {
  const effectNodes = effects?.effect;
  if (!effectNodes) return undefined;
  const list = Array.isArray(effectNodes) ? effectNodes : [effectNodes];
  const physical = list.find((e) => e['@_name'] === 'PhysicalDamage');
  if (!physical?.power?.value) return undefined;
  const values = physical.power.value;
  const powerValues = Array.isArray(values) ? values : [values];
  const l1 = powerValues.find((v) => v['@_level'] === '1');
  return l1?.['#text'];
}

function requireAttr(id: string | number, field: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field "${field}" for entity id ${id}`);
  }
}
