import { findPath } from '@nj/game-core';

/** Build preview polyline points for click-to-move (non-authoritative UX). */
export function buildPathPreviewPoints(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number
): Array<{ x: number; z: number }> {
  const path = findPath({ x: fromX, z: fromZ }, { x: toX, z: toZ });
  if (path.length === 0) return [];
  return [{ x: fromX, z: fromZ }, ...path];
}
