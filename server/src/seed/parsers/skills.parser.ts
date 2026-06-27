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

  return {
    skillId: parseNumber(id, 'id', id),
    name: parseString(id, 'name', skill['@_name']),
    maxLevel: parseNumber(id, 'toLevel', skill['@_toLevel']),
    operateType: parseString(id, 'operateType', skill.operateType),
    targetType: parseString(id, 'targetType', skill.targetType),
    castRange: parseNumber(id, 'castRange', skill.castRange),
    reuseDelay: parseNumber(id, 'reuseDelay', skill.reuseDelay),
    mpConsumeL1: parseNumber(id, 'mpConsumeL1', mpL1),
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

function requireAttr(id: string | number, field: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field "${field}" for entity id ${id}`);
  }
}
