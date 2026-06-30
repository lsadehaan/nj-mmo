import { xmlParser } from './xml-utils';

interface StatNode {
  '@_value': string | number;
  '@_bonus': string | number;
}

interface StatBonusDoc {
  list?: {
    CON?: { stat?: StatNode | StatNode[] };
  };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Parse L2J statBonus.xml CON section into value→bonus map. */
export function parseConBonusTable(xml: string): Record<number, number> {
  const doc = xmlParser.parse(xml) as StatBonusDoc;
  const stats = asArray(doc.list?.CON?.stat);
  const entries: Record<number, number> = {};
  for (const stat of stats) {
    const value = Number(stat['@_value']);
    const bonus = Number(stat['@_bonus']);
    if (Number.isNaN(value) || Number.isNaN(bonus)) continue;
    entries[value] = bonus;
  }
  return entries;
}
