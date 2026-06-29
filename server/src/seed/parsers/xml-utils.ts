import { XMLParser } from 'fast-xml-parser';

export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) =>
    name === 'npc' ||
    name === 'experience' ||
    name === 'skill' ||
    name === 'skillTree' ||
    name === 'item' ||
    name === 'level' ||
    name === 'class',
});

export function requireAttr(
  entityId: string | number,
  field: string,
  value: unknown
): asserts value is string | number {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field "${field}" for entity id ${entityId}`);
  }
}

export function parseNumber(
  entityId: string | number,
  field: string,
  value: unknown
): number {
  requireAttr(entityId, field, value);
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid numeric field "${field}" for entity id ${entityId}: ${value}`);
  }
  return n;
}

export function parseString(
  entityId: string | number,
  field: string,
  value: unknown
): string {
  requireAttr(entityId, field, value);
  return String(value);
}
