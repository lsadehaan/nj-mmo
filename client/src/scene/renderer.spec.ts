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

const { mockWebGLRendererParams } = vi.hoisted(() => ({
  mockWebGLRendererParams: [] as unknown[],
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    shadowMap = { enabled: false, type: 0 };
    toneMapping = 0;
    outputColorSpace = '';
    constructor(params: unknown) {
      mockWebGLRendererParams.push(params);
    }
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

import { MOB_RENDER_DISTANCE } from '@nj/game-core';
import {
  createRenderer,
  FOG_NEAR_M,
  FOG_FAR_M,
  SUN_SHADOW_MAP_SIZE,
  SUN_SHADOW_FRUSTUM_M,
} from './renderer';

describe('renderer', () => {
  beforeEach(() => {
    initGameState();
    mockVfxTick.mockClear();
    mockVfxPublishHook.mockClear();
    mockWebGLRendererParams.length = 0;
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

  describe('VFU-01/05/06/07/08/09/10: visual fidelity renderer config', () => {
    it('VFU-05: constructs WebGLRenderer with antialias enabled', async () => {
      const canvas = document.createElement('canvas');
      await createRenderer(canvas);

      expect(mockWebGLRendererParams[0]).toMatchObject({ antialias: true });
    });

    it('VFU-01: enables a soft PCF shadow map on the renderer', async () => {
      const canvas = document.createElement('canvas');
      const game = await createRenderer(canvas);

      expect(game.renderer.shadowMap.enabled).toBe(true);
      expect(game.renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
    });

    it('VFU-01: configures the sun as a shadow caster with the sized frustum', async () => {
      const canvas = document.createElement('canvas');
      const game = await createRenderer(canvas);

      const sun = game.scene.children.find(
        (c): c is THREE.DirectionalLight => c instanceof THREE.DirectionalLight
      );
      expect(sun).toBeDefined();
      expect(sun!.castShadow).toBe(true);
      expect(sun!.shadow.mapSize.width).toBe(SUN_SHADOW_MAP_SIZE);
      expect(sun!.shadow.mapSize.height).toBe(SUN_SHADOW_MAP_SIZE);
      expect(sun!.shadow.camera.left).toBe(-SUN_SHADOW_FRUSTUM_M);
      expect(sun!.shadow.camera.right).toBe(SUN_SHADOW_FRUSTUM_M);
      expect(sun!.shadow.camera.top).toBe(SUN_SHADOW_FRUSTUM_M);
      expect(sun!.shadow.camera.bottom).toBe(-SUN_SHADOW_FRUSTUM_M);
    });

    it('VFU-06: sets ACES filmic tonemapping and sRGB output color space', async () => {
      const canvas = document.createElement('canvas');
      const game = await createRenderer(canvas);

      expect(game.renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
      expect(game.renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    });

    it('VFU-08/09/10: attaches a barely-there fog matching the sky color', async () => {
      const canvas = document.createElement('canvas');
      const game = await createRenderer(canvas);

      expect(game.scene.fog).toBeInstanceOf(THREE.Fog);
      const fog = game.scene.fog as THREE.Fog;
      expect(fog.color.getHex()).toBe(0x87ceeb);
      expect(fog.near).toBe(FOG_NEAR_M);
      expect(fog.far).toBe(FOG_FAR_M);
      expect(fog.near).toBeGreaterThanOrEqual(MOB_RENDER_DISTANCE);
      expect(fog.near).toBeLessThan(fog.far);
      expect(fog.far).toBeLessThan(game.camera.far);
    });

    it('VFU-07: renderer factory does not throw under the mocked WebGLRenderer', async () => {
      const canvas = document.createElement('canvas');
      await expect(createRenderer(canvas)).resolves.toBeDefined();
    });
  });

  describe('VFU-03/04: shadow frustum follows the local player', () => {
    function getSun(game: Awaited<ReturnType<typeof createRenderer>>): THREE.DirectionalLight {
      const sun = game.scene.children.find(
        (c): c is THREE.DirectionalLight => c instanceof THREE.DirectionalLight
      );
      expect(sun).toBeDefined();
      return sun!;
    }

    it('VFU-03: adds the sun target to the scene', async () => {
      const canvas = document.createElement('canvas');
      const game = await createRenderer(canvas);
      const sun = getSun(game);

      expect(game.scene.children).toContain(sun.target);
    });

    it('VFU-03: re-centers the sun and its target on a large player move, preserving the original offset', async () => {
      const canvas = document.createElement('canvas');
      const game = await createRenderer(canvas);
      const sun = getSun(game);
      const initialOffsetX = sun.position.x;
      const initialOffsetY = sun.position.y;
      const initialOffsetZ = sun.position.z;

      game.syncLocalPlayer(50, 5, 40, 0, 0, 0, 0, 0);

      expect(sun.position.x).toBeCloseTo(50 + initialOffsetX, 5);
      expect(sun.position.y).toBeCloseTo(initialOffsetY, 5);
      expect(sun.position.z).toBeCloseTo(40 + initialOffsetZ, 5);
      expect(sun.target.position.x).toBeCloseTo(50, 5);
      expect(sun.target.position.z).toBeCloseTo(40, 5);
    });

    it('VFU-03: does NOT reposition the sun for a move below the cull-move threshold', async () => {
      const canvas = document.createElement('canvas');
      const game = await createRenderer(canvas);
      const sun = getSun(game);

      game.syncLocalPlayer(50, 5, 40, 0, 0, 0, 0, 0);
      const settledX = sun.position.x;
      const settledZ = sun.position.z;

      game.syncLocalPlayer(50.5, 5, 40, 0, 0, 0, 0, 0);

      expect(sun.position.x).toBeCloseTo(settledX, 5);
      expect(sun.position.z).toBeCloseTo(settledZ, 5);
    });
  });
});
