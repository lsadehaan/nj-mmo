export interface SeededRng {
  nextFloat(): number;
  nextInt(min: number, max: number): number;
  nextDamageOffset(randomDamage: number): number;
}

export function createSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;

  const nextFloat = (): number => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  return {
    nextFloat,
    nextInt(min: number, max: number): number {
      const range = max - min + 1;
      return min + Math.floor(nextFloat() * range);
    },
    nextDamageOffset(randomDamage: number): number {
      if (randomDamage <= 0) return 0;
      return this.nextInt(-randomDamage, randomDamage);
    },
  };
}
