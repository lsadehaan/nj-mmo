import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  SKILL_FLASH_DURATION_MS,
  countSkillFlashMeshes,
  createSkillFlash,
} from './skill-flash';

describe('skill-flash', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a procedural flash mesh to the scene when triggered', () => {
    expect(countSkillFlashMeshes(scene)).toBe(0);
    createSkillFlash(scene, { x: 0, y: 1, z: 0 }, { x: 2, y: 1, z: 0 });
    expect(countSkillFlashMeshes(scene)).toBeGreaterThan(0);
  });

  it('removes the flash mesh after the configured duration', () => {
    createSkillFlash(scene, { x: 0, y: 1, z: 0 }, { x: 2, y: 1, z: 0 });
    expect(countSkillFlashMeshes(scene)).toBeGreaterThan(0);
    vi.advanceTimersByTime(SKILL_FLASH_DURATION_MS);
    expect(countSkillFlashMeshes(scene)).toBe(0);
  });
});
