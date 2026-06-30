/** First-class transfer options keyed by starter classId (L2J PlayerClass children). */
export const FIRST_CLASS_OPTIONS: Readonly<Record<number, readonly number[]>> = {
  0: [1, 4, 7],
  10: [11, 15],
  18: [19, 22],
  25: [26, 29],
  31: [32, 35],
  38: [39, 42],
  44: [45, 47],
  49: [50],
  53: [54, 56],
};

const FIGHTER_STARTERS = new Set([0, 18, 31, 44, 53]);
const MYSTIC_STARTERS = new Set([10, 25, 38, 49]);

export const CLASS_TRANSFER_MIN_LEVEL = 20;

export function getFirstClassOptions(starterClassId: number): readonly number[] {
  return FIRST_CLASS_OPTIONS[starterClassId] ?? [];
}

export function canTransferClass(opts: {
  currentClassId: number;
  targetClassId: number;
  level: number;
  masterKind: 'fighter' | 'priest';
}): boolean {
  if (opts.level < CLASS_TRANSFER_MIN_LEVEL) return false;

  const options = getFirstClassOptions(opts.currentClassId);
  if (!options.includes(opts.targetClassId)) return false;

  if (opts.masterKind === 'fighter') {
    return FIGHTER_STARTERS.has(opts.currentClassId);
  }
  return MYSTIC_STARTERS.has(opts.currentClassId);
}
