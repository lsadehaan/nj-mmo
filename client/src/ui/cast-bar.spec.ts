import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountCastBar, updateCastBar } from './cast-bar';

describe('cast bar DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows cast progress over hitTime window (SKILL20-30)', () => {
    mountCastBar();
    const castStartMs = 1_000;
    const castEndMs = 5_000;

    updateCastBar({
      castingSkillId: 1177,
      castEndMs,
      castStartMs,
      nowMs: castStartMs,
    });

    const bar = document.getElementById('cast-bar');
    expect(bar?.hidden).toBe(false);
    const fill = bar?.querySelector('[data-role="fill"]') as HTMLElement | null;
    expect(fill?.style.width).toBe('0%');

    updateCastBar({
      castingSkillId: 1177,
      castEndMs,
      castStartMs,
      nowMs: castStartMs + 2_000,
    });
    expect(fill?.style.width).toBe('50%');

    updateCastBar({
      castingSkillId: 1177,
      castEndMs,
      castStartMs,
      nowMs: castEndMs + 1,
    });
    expect(bar?.hidden).toBe(true);
  });
});
