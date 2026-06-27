import { join } from 'node:path';
import { existsSync } from 'node:fs';

export const DEFAULT_L2J_DATA_DIR =
  process.env['L2J_DATA_DIR'] ??
  join(process.env['HOME'] ?? '', 'Dev/L2J_Mobius/L2J_Mobius_Classic_1.0/dist/game/data');

export const FIXTURE_DATA_DIR = join(__dirname, '__fixtures__');

export const TI_MOB_IDS = [20001, 20481, 20120, 20003] as const;
export const TI_NPC_IDS = [30004, 30006] as const;

export function resolveDataDir(dataDir?: string): string {
  const dir = dataDir ?? DEFAULT_L2J_DATA_DIR;
  if (!existsSync(dir)) {
    throw new Error(
      `L2J data directory not found at "${dir}". Set L2J_DATA_DIR or pass dataDir explicitly.`
    );
  }
  return dir;
}

export function fixturePath(name: string): string {
  return join(FIXTURE_DATA_DIR, name);
}
