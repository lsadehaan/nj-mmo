import type { NewExperienceRow } from '../../db/schema';
import { xmlParser, parseNumber } from './xml-utils';

interface ExperienceNode {
  '@_level': string;
  '@_tolevel': string;
  '@_trainingRate': string;
}

export function parseExperience(xml: string): NewExperienceRow[] {
  const doc = xmlParser.parse(xml) as { table?: { experience?: ExperienceNode[] } };
  const nodes = doc.table?.experience ?? [];

  if (nodes.length === 0) {
    throw new Error('No experience rows found in XML');
  }

  return nodes.map((node) => {
    const level = node['@_level'];
    requireAttr(level, 'tolevel', node['@_tolevel']);
    requireAttr(level, 'trainingRate', node['@_trainingRate']);

    return {
      level: parseNumber(level, 'level', level),
      xpToNextLevel: parseNumber(level, 'tolevel', node['@_tolevel']),
      trainingRate: parseNumber(level, 'trainingRate', node['@_trainingRate']),
    };
  });
}

function requireAttr(id: string | number, field: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field "${field}" for entity id ${id}`);
  }
}
