import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseConBonusTable, parseStatBonusTable } from './stat-bonus.parser';
import { FIXTURE_DATA_DIR } from '../paths';

describe('parseConBonusTable', () => {
  it('parses CON entries from L2J statBonus fixture', () => {
    const xml = readFileSync(
      join(FIXTURE_DATA_DIR, 'players/statBonus_con_subset.xml'),
      'utf8'
    );
    const table = parseConBonusTable(xml);
    expect(table[25]).toBeCloseTo(0.93, 2);
    expect(table[43]).toBeCloseTo(1.58, 2);
    expect(Object.keys(table).length).toBeGreaterThan(100);
  });
});

describe('parseStatBonusTable (full statBonus.xml)', () => {
  const xml = readFileSync(
    join(FIXTURE_DATA_DIR, 'players/statBonus.xml'),
    'utf8'
  );

  it.each([
    ['STR', 40, 1.2],
    ['INT', 34, 1.05],
    ['DEX', 34, 1.14],
    ['CON', 34, 1.21],
  ] as const)('covers %s value %i across the full 0-200 range', (stat, value, bonus) => {
    const table = parseStatBonusTable(xml, stat);
    expect(table[value]).toBeCloseTo(bonus, 2);
    expect(table[0]).toBeDefined();
    expect(table[200]).toBeDefined();
  });
});
