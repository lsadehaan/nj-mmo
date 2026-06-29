/** L2J Talking Island village logical origin (AD-013). */
export const L2_ANCHOR = { x: -84300, y: 243400 } as const;

export const L2_TO_LOCAL_SCALE = 0.01;

export function l2ToLocal(l2x: number, l2y: number): { x: number; z: number } {
  return {
    x: (l2x - L2_ANCHOR.x) * L2_TO_LOCAL_SCALE,
    z: -(l2y - L2_ANCHOR.y) * L2_TO_LOCAL_SCALE,
  };
}

export function localToL2(x: number, z: number): { x: number; y: number } {
  return {
    x: x / L2_TO_LOCAL_SCALE + L2_ANCHOR.x,
    y: L2_ANCHOR.y - z / L2_TO_LOCAL_SCALE,
  };
}
