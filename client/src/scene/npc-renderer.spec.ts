import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildNpcMesh,
  npcRoleFromType,
  npcStateToVisual,
  type NpcVisualRole,
} from './npc-renderer';

describe('npc-renderer', () => {
  it('buildNpcMesh returns a THREE.Group with at least one mesh', () => {
    const group = buildNpcMesh('Merchant');
    expect(group).toBeInstanceOf(THREE.Group);
    let meshCount = 0;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) meshCount += 1;
    });
    expect(meshCount).toBeGreaterThanOrEqual(1);
  });

  it('uses distinct body colors for Merchant vs Helper roles', () => {
    const merchantColor = readBodyColor(buildNpcMesh('Merchant'));
    const helperColor = readBodyColor(buildNpcMesh('Helper'));
    expect(merchantColor).not.toBe(helperColor);
    expect(merchantColor).toBe(0xcc8844);
    expect(helperColor).toBe(0x44aa66);
  });

  it('maps server npc state to visual snapshot without mutating source', () => {
    const server = {
      id: 'npc-30004',
      npcId: 30004,
      name: 'Katerina',
      type: 'Merchant',
      x: -6,
      y: 4.26,
      z: -8,
    };
    const visual = npcStateToVisual(server);
    expect(visual).toEqual({
      id: 'npc-30004',
      npcId: 30004,
      role: 'Merchant' as NpcVisualRole,
      x: -6,
      y: 4.26,
      z: -8,
    });
    expect(visual).not.toBe(server);
    server.x = 0;
    expect(visual.x).toBe(-6);
  });

  it('maps Roxxy teleporter type to Helper role for MVP dialog UX', () => {
    expect(npcRoleFromType('Teleporter', 30006)).toBe('Helper');
    expect(npcRoleFromType('Merchant', 30004)).toBe('Merchant');
  });
});

function readBodyColor(group: THREE.Group): number {
  const body = group.getObjectByName('body') as THREE.Mesh | null;
  expect(body).not.toBeNull();
  if (!body) return 0;
  const material = body.material as THREE.MeshLambertMaterial;
  return material.color.getHex();
}
