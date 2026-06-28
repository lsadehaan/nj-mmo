import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FALLBACK_ICON } from './icon-manifest';
import { createIconImg } from './icon-img';

describe('createIconImg', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a mapped item img with src, alt, and size', () => {
    const img = createIconImg({
      kind: 'item',
      id: 1060,
      alt: 'Healing Potion',
      sizePx: 32,
    });

    expect(img.src).toContain('healing-potion.png');
    expect(img.alt).toBe('Healing Potion');
    expect(img.width).toBe(32);
    expect(img.height).toBe(32);
    expect(img.dataset['iconItemId']).toBe('1060');
    expect(img.dataset['iconFallback']).toBeUndefined();
  });

  it('uses FALLBACK_ICON and data-icon-fallback for unmapped item ids', () => {
    const img = createIconImg({
      kind: 'item',
      id: 99999,
      alt: 'Unknown',
      sizePx: 32,
    });

    expect(img.src).toContain(FALLBACK_ICON);
    expect(img.dataset['iconFallback']).toBe('true');
  });

  it('sets data-icon-skill-id for skill icons', () => {
    const img = createIconImg({
      kind: 'skill',
      id: 3,
      alt: 'Power Strike',
      sizePx: 48,
    });

    expect(img.dataset['iconSkillId']).toBe('3');
    expect(img.src).toContain('power-strike.png');
  });

  it('clamps sizePx at or below zero to 16px minimum', () => {
    const zero = createIconImg({ kind: 'item', id: 57, alt: 'Adena', sizePx: 0 });
    const negative = createIconImg({ kind: 'item', id: 57, alt: 'Adena', sizePx: -4 });

    expect(zero.width).toBe(16);
    expect(zero.height).toBe(16);
    expect(negative.width).toBe(16);
    expect(negative.height).toBe(16);
  });
});
