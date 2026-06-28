import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { initGameState } from '../test-hook';

const { mockVfxTick, mockVfxPublishHook } = vi.hoisted(() => ({
  mockVfxTick: vi.fn(),
  mockVfxPublishHook: vi.fn(),
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer as unknown as typeof actual.WebGLRenderer,
  };
});

vi.mock('./vfx/vfx-manager', () => ({
  createVfxManager: vi.fn(() => ({
    syncPlayer: vi.fn(),
    syncMob: vi.fn(),
    setTargetMobId: vi.fn(),
    attachMobDissolve: vi.fn(),
    attachPlayerDissolve: vi.fn(),
    tick: mockVfxTick,
    dispose: vi.fn(),
    getHookSnapshot: vi.fn(() => ({
      powerStrikeCount: 0,
      meleeHitCount: 0,
      levelUpCount: 0,
      targetRingVisible: false,
      activeEffectCount: 0,
    })),
    publishHook: mockVfxPublishHook,
  })),
}));

vi.mock('./player-avatar', () => ({
  createPlayerAvatar: vi.fn(() => ({
    group: new THREE.Group(),
    sync: vi.fn(),
    update: vi.fn(() => 'idle' as const),
    ready: Promise.resolve(),
  })),
}));

import { createRenderer } from './renderer';

describe('renderer', () => {
  beforeEach(() => {
    initGameState();
    mockVfxTick.mockClear();
    mockVfxPublishHook.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls vfxManager.tick on each frame tick', async () => {
    const canvas = document.createElement('canvas');
    const game = await createRenderer(canvas);

    game.tick(0.016);

    expect(mockVfxTick).toHaveBeenCalledTimes(1);
    expect(typeof mockVfxTick.mock.calls[0]?.[0]).toBe('number');
    expect(mockVfxPublishHook).toHaveBeenCalledTimes(1);
  });
});
