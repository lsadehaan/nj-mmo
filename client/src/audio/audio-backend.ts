export interface AudioBackend {
  playLoop(
    id: string,
    url: string,
    volume: number,
    options?: { fadeMs?: number }
  ): void;
  playOneShot(id: string, url: string, volume: number): void;
  stopLoop(id: string, options?: { fadeMs?: number }): void;
  stopAll(): void;
  dispose(): void;
}

export type MockAudioCall =
  | { kind: 'loop'; id: string; url: string; volume: number; fadeMs?: number }
  | { kind: 'oneShot'; id: string; url: string; volume: number }
  | { kind: 'stop'; id: string; fadeMs?: number }
  | { kind: 'stopAll' }
  | { kind: 'dispose' };

export function isOneShotCall(
  call: MockAudioCall
): call is Extract<MockAudioCall, { kind: 'oneShot' }> {
  return call.kind === 'oneShot';
}

export function isLoopCall(
  call: MockAudioCall
): call is Extract<MockAudioCall, { kind: 'loop' }> {
  return call.kind === 'loop';
}

export function isStopCall(
  call: MockAudioCall
): call is Extract<MockAudioCall, { kind: 'stop' }> {
  return call.kind === 'stop';
}

export function createMockAudioBackend(): {
  backend: AudioBackend;
  calls: MockAudioCall[];
  reset: () => void;
} {
  const calls: MockAudioCall[] = [];

  const backend: AudioBackend = {
    playLoop(id, url, volume, options) {
      calls.push({ kind: 'loop', id, url, volume, fadeMs: options?.fadeMs });
    },
    playOneShot(id, url, volume) {
      calls.push({ kind: 'oneShot', id, url, volume });
    },
    stopLoop(id, options) {
      calls.push({ kind: 'stop', id, fadeMs: options?.fadeMs });
    },
    stopAll() {
      calls.push({ kind: 'stopAll' });
    },
    dispose() {
      calls.push({ kind: 'dispose' });
    },
  };

  return {
    backend,
    calls,
    reset: () => {
      calls.length = 0;
    },
  };
}

const warnedMissing = new Set<string>();

function warnOnce(id: string, message: string): void {
  if (warnedMissing.has(id)) return;
  warnedMissing.add(id);
  console.warn(message);
}

export function createDomAudioBackend(): AudioBackend {
  const loopElements = new Map<string, HTMLAudioElement>();
  let disposed = false;
  let unlockBound = false;

  const tryUnlock = (): void => {
    for (const el of loopElements.values()) {
      void el.play().catch(() => undefined);
    }
  };

  const bindUnlock = (): void => {
    if (unlockBound || typeof document === 'undefined') return;
    unlockBound = true;
    document.addEventListener(
      'pointerdown',
      () => {
        tryUnlock();
      },
      { once: true }
    );
  };

  const createAudio = (url: string, loop: boolean): HTMLAudioElement => {
    const el = new Audio(url);
    el.loop = loop;
    el.preload = 'auto';
    el.addEventListener('error', () => {
      warnOnce(url, `[audio] failed to load ${url}`);
    });
    return el;
  };

  const rampVolume = (
    el: HTMLAudioElement,
    from: number,
    to: number,
    fadeMs: number,
    onDone?: () => void
  ): void => {
    if (fadeMs <= 0) {
      el.volume = to;
      onDone?.();
      return;
    }
    const start = performance.now();
    const step = (): void => {
      const t = Math.min(1, (performance.now() - start) / fadeMs);
      el.volume = from + (to - from) * t;
      if (t >= 1) {
        onDone?.();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  return {
    playLoop(id, url, volume, options) {
      if (disposed) return;
      bindUnlock();
      let el = loopElements.get(id);
      if (!el) {
        el = createAudio(url, true);
        loopElements.set(id, el);
      }
      const target = Math.max(0, Math.min(1, volume));
      if (options?.fadeMs && options.fadeMs > 0) {
        rampVolume(el, el.volume, target, options.fadeMs);
      } else {
        el.volume = target;
      }
      void el.play().catch(() => undefined);
    },

    playOneShot(id, url, volume) {
      if (disposed) return;
      bindUnlock();
      const el = createAudio(url, false);
      el.volume = Math.max(0, Math.min(1, volume));
      void el.play().catch(() => undefined);
      el.addEventListener('ended', () => {
        el.src = '';
      });
      void id;
    },

    stopLoop(id, options) {
      const el = loopElements.get(id);
      if (!el) return;
      if (options?.fadeMs && options.fadeMs > 0) {
        rampVolume(el, el.volume, 0, options.fadeMs, () => {
          el.pause();
          el.currentTime = 0;
          loopElements.delete(id);
        });
      } else {
        el.pause();
        el.currentTime = 0;
        loopElements.delete(id);
      }
    },

    stopAll() {
      for (const id of [...loopElements.keys()]) {
        const el = loopElements.get(id);
        el?.pause();
      }
      loopElements.clear();
    },

    dispose() {
      disposed = true;
      this.stopAll();
    },
  };
}
