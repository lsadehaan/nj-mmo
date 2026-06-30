import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { initGameState } from '../test-hook';
import { createMockAudioBackend } from '../audio/audio-backend';
import { createAudioManager } from '../audio/audio-manager';

const { mockVfxTick, mockVfxPublishHook, mockTickFootsteps } = vi.hoisted(() => ({
  mockVfxTick: vi.fn(),
  mockVfxPublishHook: vi.fn(),
  mockTickFootsteps: vi.fn(),
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

vi.mock('./environment-renderer', () => ({
  buildEnvironmentScene: vi.fn(async () => ({
    buildings: { count: 5, renderKind: 'mesh' as const },
    scatter: { count: 220, renderKind: 'mesh' as const },
    peaceZone: { count: 1, renderKind: 'mesh' as const },
    landmarks: { count: 6, renderKind: 'mesh' as const },
  })),
}));

vi.mock('./player-avatar', () => ({
  createPlayerAvatar: vi.fn(() => ({
    group: new THREE.Group(),
    sync: vi.fn(),
    update: vi.fn(() => 'idle' as const),
    setName: vi.fn(),
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

  it('AUD29-45: tickFootsteps invoked when audio manager attached', async () => {
    const canvas = document.createElement('canvas');
    const game = await createRenderer(canvas);
    const mock = createMockAudioBackend();
    const mgr = createAudioManager({ backend: mock.backend });
    const tickSpy = vi.spyOn(mgr, 'tickFootsteps');
    game.setAudioManager(mgr);

    game.tick(0.016);

    expect(tickSpy).toHaveBeenCalledTimes(1);
    expect(tickSpy.mock.calls[0]?.[0]).toMatchObject({ x: expect.any(Number), z: expect.any(Number) });
  });
});
