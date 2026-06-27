export interface SeededRng {
  next(): number;
}

export function createSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 0x100000000;
    },
  };
}

export interface PropSpec {
  kind: 'tree' | 'rock';
  x: number;
  y: number;
  z: number;
  scale: number;
}

export interface ScatterOptions {
  count: number;
  fieldMin: number;
  fieldMax: number;
  villageRadius: number;
}

export interface TerrainSampler {
  sampleHeight: (x: number, z: number) => number;
}

export function scatterProps(
  seed: number,
  terrain: TerrainSampler,
  opts: ScatterOptions,
  rng: SeededRng = createSeededRng(seed)
): PropSpec[] {
  const props: PropSpec[] = [];
  let attempts = 0;

  while (props.length < opts.count && attempts < opts.count * 20) {
    attempts++;
    const x = opts.fieldMin + rng.next() * (opts.fieldMax - opts.fieldMin);
    const z = opts.fieldMin + rng.next() * (opts.fieldMax - opts.fieldMin);

    if (Math.hypot(x, z) < opts.villageRadius) continue;

    props.push({
      kind: props.length % 3 === 0 ? 'rock' : 'tree',
      x,
      y: terrain.sampleHeight(x, z),
      z,
      scale: 0.8 + rng.next() * 0.6,
    });
  }

  return props;
}
