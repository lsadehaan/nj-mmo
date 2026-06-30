import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseConBonusTable } from './stat-bonus.parser';
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
