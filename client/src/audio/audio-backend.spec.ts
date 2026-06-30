import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockAudioBackend, isLoopCall, isOneShotCall } from './audio-backend';
import { createAudioManager } from './audio-manager';

describe('audio-backend mock', () => {
  it('AUD29-46: mock path never constructs global Audio', () => {
    const audioSpy = vi.spyOn(globalThis, 'Audio');
    const { backend } = createMockAudioBackend();
    backend.playLoop('music_town', '/audio/music/music_town.mp3', 0.7);
    backend.playOneShot('sfx_ui_click', '/audio/sfx/sfx_ui_click.mp3', 0.8);
    backend.dispose();
    expect(audioSpy).not.toHaveBeenCalled();
    audioSpy.mockRestore();
  });
});

describe('audio-manager foundation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('AUD29-01: createAudioManager exposes required API', () => {
    const { backend } = createMockAudioBackend();
    const mgr = createAudioManager({ backend });
    expect(typeof mgr.playLoop).toBe('function');
    expect(typeof mgr.playOneShot).toBe('function');
    expect(typeof mgr.stopLoop).toBe('function');
    expect(typeof mgr.setMusicVolume).toBe('function');
    expect(typeof mgr.setSfxVolume).toBe('function');
    expect(typeof mgr.setMuted).toBe('function');
    expect(typeof mgr.dispose).toBe('function');
  });

  it('AUD29-02: playOneShot records oneShot on mock', () => {
    const { backend, calls } = createMockAudioBackend();
    const mgr = createAudioManager({ backend });
    mgr.playOneShot('sfx_ui_click');
    expect(calls).toEqual([
      {
        kind: 'oneShot',
        id: 'sfx_ui_click',
        url: '/audio/sfx/sfx_ui_click.mp3',
        volume: 0.8,
      },
    ]);
  });

  it('AUD29-03: duplicate playLoop is idempotent', () => {
    const { backend, calls } = createMockAudioBackend();
    const mgr = createAudioManager({ backend });
    mgr.playLoop('music_town');
    mgr.playLoop('music_town');
    expect(calls.filter((c) => c.kind === 'loop' && c.id === 'music_town')).toHaveLength(1);
  });

  it('AUD29-04: stopLoop after playLoop records stop', () => {
    const { backend, calls } = createMockAudioBackend();
    const mgr = createAudioManager({ backend });
    mgr.playLoop('music_town');
    mgr.stopLoop('music_town');
    expect(calls.some((c) => c.kind === 'stop' && c.id === 'music_town')).toBe(true);
  });

  it('AUD29-05: setMusicVolume affects next playLoop volume', () => {
    const { backend, calls } = createMockAudioBackend();
    const mgr = createAudioManager({ backend });
    mgr.setMusicVolume(0.5);
    mgr.playLoop('music_town');
    const loop = calls.find((c) => isLoopCall(c) && c.id === 'music_town');
    if (!loop || !isLoopCall(loop)) throw new Error('expected loop call');
    expect(loop.volume).toBeCloseTo(0.5, 2);
  });

  it('AUD29-06: setSfxVolume affects next oneShot volume', () => {
    const { backend, calls } = createMockAudioBackend();
    const mgr = createAudioManager({ backend });
    mgr.setSfxVolume(0.25);
    mgr.playOneShot('sfx_ui_click');
    const shot = calls.find(isOneShotCall);
    expect(shot?.volume).toBeCloseTo(0.25, 2);
  });

  it('AUD29-07: muted forces effective volume 0', () => {
    const { backend, calls } = createMockAudioBackend();
    const mgr = createAudioManager({ backend });
    mgr.setMusicVolume(0.5);
    mgr.setSfxVolume(0.5);
    mgr.setMuted(true);
    mgr.playLoop('music_town');
    mgr.playOneShot('sfx_ui_click');
    expect(calls.find(isLoopCall)?.volume).toBe(0);
    expect(calls.find(isOneShotCall)?.volume).toBe(0);
  });

  it('AUD29-08: dispose stops loops and calls backend dispose', () => {
    const { backend, calls } = createMockAudioBackend();
    const mgr = createAudioManager({ backend });
    mgr.playLoop('music_town');
    mgr.dispose();
    expect(calls.some((c) => c.kind === 'stop' && c.id === 'music_town')).toBe(true);
    expect(calls.some((c) => c.kind === 'dispose')).toBe(true);
  });
});
