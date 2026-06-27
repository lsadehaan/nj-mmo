import { describe, it, expect } from 'vitest';
import {
  createMobGroup,
  hpBarFillRatio,
  mobStateToVisual,
  removeMob,
  syncMobVisual,
  type MobMeshMap,
  type MobVisualState,
} from './mobs';

describe('mobs visual mapping', () => {
  it('maps server mob state to visual snapshot without mutating hp', () => {
    const server = { id: 'mob-1', x: 12, y: 4.26, z: -18, hp: 30, maxHp: 41 };
    const visual = mobStateToVisual(server);

    expect(visual).toEqual({
      id: 'mob-1',
      x: 12,
      y: 4.26,
      z: -18,
      hp: 30,
      maxHp: 41,
    });
    expect(visual).not.toBe(server);
    server.hp = 0;
    expect(visual.hp).toBe(30);
  });

  it('computes hp bar fill ratio clamped to 0..1', () => {
    expect(hpBarFillRatio(20, 40)).toBe(0.5);
    expect(hpBarFillRatio(0, 40)).toBe(0);
    expect(hpBarFillRatio(50, 40)).toBe(1);
    expect(hpBarFillRatio(10, 0)).toBe(0);
  });

  it('creates and updates mob mesh position and hp bar from server snapshot', () => {
    const scene = { add: () => undefined, remove: () => undefined };
    const map: MobMeshMap = new Map();

    const first: MobVisualState = {
      id: 'mob-a',
      x: 1,
      y: 2,
      z: 3,
      hp: 40,
      maxHp: 80,
    };
    syncMobVisual(map, first, scene as never);
    expect(map.size).toBe(1);
    const group = map.get('mob-a')!;
    expect(group.position.x).toBe(1);
    expect(group.position.y).toBe(2);
    expect(group.position.z).toBe(3);
    expect(group.userData.mobId).toBe('mob-a');

    syncMobVisual(
      map,
      { ...first, x: 4, y: 5, z: 6, hp: 20, maxHp: 80 },
      scene as never
    );
    expect(map.size).toBe(1);
    expect(map.get('mob-a')).toBe(group);
    expect(group.position.x).toBe(4);
    expect(group.position.z).toBe(6);
  });

  it('removes mob group from map and scene', () => {
    const removed: unknown[] = [];
    const scene = {
      add: () => undefined,
      remove: (obj: unknown) => removed.push(obj),
    };
    const map: MobMeshMap = new Map();
    const group = createMobGroup('mob-b');
    map.set('mob-b', group);

    removeMob(map, 'mob-b', scene as never);

    expect(map.has('mob-b')).toBe(false);
    expect(removed).toEqual([group]);
  });
});
