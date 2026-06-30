import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerConBonusEntries } from '@nj/game-core';
import { FIXTURE_DATA_DIR } from '../seed/paths';
import { parseConBonusTable } from '../seed/parsers/stat-bonus.parser';

let registered = false;

/** Register full CON bonus table from L2J fixture (once per process). */
export function ensureConBonusesRegistered(): void {
  if (registered) return;
  const xml = readFileSync(
    join(FIXTURE_DATA_DIR, 'players/statBonus_con_subset.xml'),
    'utf8'
  );
  registerConBonusEntries(parseConBonusTable(xml));
  registered = true;
}
