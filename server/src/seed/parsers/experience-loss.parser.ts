import type { NewExperienceLossRow } from '../../db/schema';
import { xmlParser, parseNumber } from './xml-utils';

interface ExperienceLossNode {
  '@_level': string;
  '@_percentLost': string;
}

export function parseExperienceLoss(xml: string): NewExperienceLossRow[] {
  const doc = xmlParser.parse(xml) as {
    table?: { experienceLoss?: ExperienceLossNode[] };
  };
  const nodes = doc.table?.experienceLoss ?? [];

  if (nodes.length === 0) {
    throw new Error('No experienceLoss rows found in XML');
  }

  return nodes.map((node) => {
    const level = node['@_level'];
    requireAttr(level, 'percentLost', node['@_percentLost']);

    return {
      level: parseNumber(level, 'level', level),
      percentLost: parseNumber(level, 'percentLost', node['@_percentLost']),
    };
  });
}

function requireAttr(id: string | number, field: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field "${field}" for entity id ${id}`);
  }
}
