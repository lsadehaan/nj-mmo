import type { NewClassLevelVital, NewClassTemplate } from '../../db/schema';
import { xmlParser, parseNumber, parseString } from './xml-utils';

const STARTER_CLASS_IDS = [0, 10, 18, 25, 31, 38, 44, 49, 53] as const;

const RACE_BY_CLASS: Record<number, NewClassTemplate['race']> = {
  0: 'human',
  10: 'human',
  18: 'elf',
  25: 'elf',
  31: 'dark_elf',
  38: 'dark_elf',
  44: 'orc',
  49: 'orc',
  53: 'dwarf',
  1: 'human',
  4: 'human',
  7: 'human',
  11: 'human',
  15: 'human',
  19: 'elf',
  22: 'elf',
  26: 'elf',
  29: 'elf',
  32: 'dark_elf',
  35: 'dark_elf',
  39: 'dark_elf',
  42: 'dark_elf',
  45: 'orc',
  47: 'orc',
  50: 'orc',
  54: 'dwarf',
  56: 'dwarf',
};

const ARCHETYPE_BY_CLASS: Record<number, NewClassTemplate['archetype']> = {
  0: 'fighter',
  10: 'mystic',
  18: 'fighter',
  25: 'mystic',
  31: 'fighter',
  38: 'mystic',
  44: 'fighter',
  49: 'mystic',
  53: 'fighter',
  1: 'fighter',
  4: 'fighter',
  7: 'fighter',
  11: 'mystic',
  15: 'mystic',
  19: 'fighter',
  22: 'fighter',
  26: 'mystic',
  29: 'mystic',
  32: 'fighter',
  35: 'fighter',
  39: 'mystic',
  42: 'mystic',
  45: 'fighter',
  47: 'fighter',
  50: 'mystic',
  54: 'fighter',
  56: 'fighter',
};

interface LevelNode {
  '@_val': string;
  hp?: string | number;
  mp?: string | number;
}

interface TemplateDoc {
  list?: {
    classId?: string | number;
    staticData?: Record<string, string | number>;
    lvlUpgainData?: { level?: LevelNode | LevelNode[] };
  };
}

interface ClassListDoc {
  list?: {
    class?: Array<{ '@_classId': string; '@_name': string }> | { '@_classId': string; '@_name': string };
  };
}

export function parseClassListSnippet(xml: string): Map<number, string> {
  const doc = xmlParser.parse(xml) as ClassListDoc;
  const nodes = doc.list?.class;
  const list = Array.isArray(nodes) ? nodes : nodes ? [nodes] : [];
  const names = new Map<number, string>();
  for (const node of list) {
    const id = parseNumber(node['@_classId'], 'classId', node['@_classId']);
    names.set(id, parseString(id, 'name', node['@_name']));
  }
  return names;
}

export interface ParsedClassTemplates {
  templates: NewClassTemplate[];
  vitals: NewClassLevelVital[];
}

export function parseStartingClassXml(
  xml: string,
  classNames: Map<number, string>
): { template: NewClassTemplate; vitals: NewClassLevelVital[] } {
  const doc = xmlParser.parse(xml) as TemplateDoc;
  const list = doc.list;
  if (list?.classId === undefined || list?.classId === null || !list.staticData) {
    throw new Error('Invalid StartingClass XML: missing classId or staticData');
  }

  const classId = parseNumber(list.classId, 'classId', list.classId);
  const sd = list.staticData;

  const template: NewClassTemplate = {
    classId,
    name: classNames.get(classId) ?? `Class ${classId}`,
    race: RACE_BY_CLASS[classId] ?? 'human',
    archetype: ARCHETYPE_BY_CLASS[classId] ?? 'fighter',
    baseStr: parseNumber(classId, 'baseSTR', sd.baseSTR),
    baseDex: parseNumber(classId, 'baseDEX', sd.baseDEX),
    baseCon: parseNumber(classId, 'baseCON', sd.baseCON),
    baseInt: parseNumber(classId, 'baseINT', sd.baseINT),
    baseWit: parseNumber(classId, 'baseWIT', sd.baseWIT),
    baseMen: parseNumber(classId, 'baseMEN', sd.baseMEN),
    basePAtk: parseNumber(classId, 'basePAtk', sd.basePAtk),
    baseRandomDamage: parseNumber(classId, 'baseRndDam', sd.baseRndDam),
    basePAtkSpd: parseNumber(classId, 'basePAtkSpd', sd.basePAtkSpd),
    baseCritRate: parseNumber(classId, 'baseCritRate', sd.baseCritRate),
  };

  const levelNodes = list.lvlUpgainData?.level;
  const levels = Array.isArray(levelNodes) ? levelNodes : levelNodes ? [levelNodes] : [];
  const vitals: NewClassLevelVital[] = levels.map((node) => {
    const level = parseNumber(classId, 'level', node['@_val']);
    return {
      classId,
      level,
      hp: parseNumber(classId, 'hp', node.hp),
      mp: parseNumber(classId, 'mp', node.mp),
    };
  });

  return { template, vitals };
}

export function parseAllStartingClasses(
  classXmls: string[],
  classListXml: string
): ParsedClassTemplates {
  const names = parseClassListSnippet(classListXml);
  const templates: NewClassTemplate[] = [];
  const vitals: NewClassLevelVital[] = [];

  for (const xml of classXmls) {
    const parsed = parseStartingClassXml(xml, names);
    templates.push(parsed.template);
    vitals.push(...parsed.vitals);
  }

  const ids = new Set(templates.map((t) => t.classId));
  for (const id of STARTER_CLASS_IDS) {
    if (!ids.has(id)) {
      throw new Error(`Missing starter class template for classId ${id}`);
    }
  }

  return { templates, vitals };
}

export { STARTER_CLASS_IDS };
