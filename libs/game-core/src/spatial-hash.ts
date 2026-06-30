/** Uniform grid spatial hash for radius queries (world x/z metres). */
export class SpatialHash<TId extends string> {
  private readonly buckets = new Map<string, Set<TId>>();
  private readonly positions = new Map<TId, { x: number; z: number }>();

  constructor(private readonly cellSize: number) {}

  private cellKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private toCell(coord: number): number {
    return Math.floor(coord / this.cellSize);
  }

  set(id: TId, x: number, z: number): void {
    const prev = this.positions.get(id);
    if (prev) {
      const prevKey = this.cellKey(this.toCell(prev.x), this.toCell(prev.z));
      this.buckets.get(prevKey)?.delete(id);
    }

    const key = this.cellKey(this.toCell(x), this.toCell(z));
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new Set();
      this.buckets.set(key, bucket);
    }
    bucket.add(id);
    this.positions.set(id, { x, z });
  }

  remove(id: TId): void {
    const prev = this.positions.get(id);
    if (!prev) return;
    const key = this.cellKey(this.toCell(prev.x), this.toCell(prev.z));
    this.buckets.get(key)?.delete(id);
    this.positions.delete(id);
  }

  queryRadius(centerX: number, centerZ: number, radius: number): TId[] {
    const r2 = radius * radius;
    const minCx = this.toCell(centerX - radius);
    const maxCx = this.toCell(centerX + radius);
    const minCz = this.toCell(centerZ - radius);
    const maxCz = this.toCell(centerZ + radius);

    const out: TId[] = [];
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.buckets.get(this.cellKey(cx, cz));
        if (!bucket) continue;
        for (const id of bucket) {
          const pos = this.positions.get(id);
          if (!pos) continue;
          const dx = pos.x - centerX;
          const dz = pos.z - centerZ;
          if (dx * dx + dz * dz <= r2) out.push(id);
        }
      }
    }
    return out;
  }
}
