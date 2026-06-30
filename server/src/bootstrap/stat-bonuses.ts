import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  registerStrBonusEntries,
  registerIntBonusEntries,
  registerDexBonusEntries,
  registerConBonusEntries,
} from '@nj/game-core';
import { FIXTURE_DATA_DIR } from '../seed/paths';
import { parseStatBonusTable } from '../seed/parsers/stat-bonus.parser';

let registered = false;

/**
 * Register the full STR/INT/DEX/CON bonus tables from the L2J statBonus fixture
 * (once per process). Combat hit/evasion/crit (DEX), p.atk (STR) and m.atk (INT)
 * look these up per swing, so a partial table throws "No <STAT> bonus entry for
 * value N" mid-combat — registering the complete 0–200 range removes that gap.
 */
export function ensureStatBonusesRegistered(): void {
  if (registered) return;
  const xml = readFileSync(
    join(FIXTURE_DATA_DIR, 'players/statBonus.xml'),
    'utf8'
  );
  registerStrBonusEntries(parseStatBonusTable(xml, 'STR'));
  registerIntBonusEntries(parseStatBonusTable(xml, 'INT'));
  registerDexBonusEntries(parseStatBonusTable(xml, 'DEX'));
  registerConBonusEntries(parseStatBonusTable(xml, 'CON'));
  registered = true;
}

/** @deprecated Use {@link ensureStatBonusesRegistered}; kept for callers. */
export function ensureConBonusesRegistered(): void {
  ensureStatBonusesRegistered();
}
