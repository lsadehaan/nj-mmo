import { xmlParser } from './xml-utils';

interface StatNode {
  '@_value': string | number;
  '@_bonus': string | number;
}

type StatSection = { stat?: StatNode | StatNode[] };

interface StatBonusDoc {
  list?: {
    STR?: StatSection;
    INT?: StatSection;
    CON?: StatSection;
    MEN?: StatSection;
    DEX?: StatSection;
    WIT?: StatSection;
  };
}

export type StatName = 'STR' | 'INT' | 'CON' | 'MEN' | 'DEX' | 'WIT';

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Parse one stat section of L2J statBonus.xml into a value→bonus map. */
export function parseStatBonusTable(xml: string, stat: StatName): Record<number, number> {
  const doc = xmlParser.parse(xml) as StatBonusDoc;
  const stats = asArray(doc.list?.[stat]?.stat);
  const entries: Record<number, number> = {};
  for (const node of stats) {
    const value = Number(node['@_value']);
    const bonus = Number(node['@_bonus']);
    if (Number.isNaN(value) || Number.isNaN(bonus)) continue;
    entries[value] = bonus;
  }
  return entries;
}

/** Parse L2J statBonus.xml CON section into value→bonus map. */
export function parseConBonusTable(xml: string): Record<number, number> {
  return parseStatBonusTable(xml, 'CON');
}
