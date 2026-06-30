import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { attachTooltip, mountTooltip, hideTooltip } from './tooltip';

function hover(el: HTMLElement, type: string): void {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 100, clientY: 100 }));
}

describe('tooltip', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the title + body on hover and hides on leave', () => {
    const host = document.createElement('button');
    document.body.appendChild(host);
    attachTooltip(host, { title: 'Power Strike', body: 'Heavy melee hit.' });

    hover(host, 'mouseenter');
    const tip = mountTooltip();
    expect(tip.hidden).toBe(false);
    expect(tip.querySelector('[data-role="tooltip-title"]')?.textContent).toBe('Power Strike');
    expect(tip.querySelector('[data-role="tooltip-body"]')?.textContent).toBe('Heavy melee hit.');

    hover(host, 'mouseleave');
    expect(tip.hidden).toBe(true);
  });

  it('reuses a single shared tooltip element across hosts', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    attachTooltip(a, { title: 'A' });
    attachTooltip(b, { title: 'B' });

    hover(a, 'mouseenter');
    hover(b, 'mouseenter');
    expect(document.querySelectorAll('#game-tooltip').length).toBe(1);
    expect(mountTooltip().querySelector('[data-role="tooltip-title"]')?.textContent).toBe('B');
  });

  it('suppresses the tooltip when the getter returns null', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    attachTooltip(host, () => null);

    hover(host, 'mouseenter');
    expect(mountTooltip().hidden).toBe(true);
  });

  it('hides on click so a used slot leaves no stale tooltip', () => {
    const host = document.createElement('button');
    document.body.appendChild(host);
    attachTooltip(host, { title: 'X' });

    hover(host, 'mouseenter');
    expect(mountTooltip().hidden).toBe(false);
    host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mountTooltip().hidden).toBe(true);
  });

  it('hideTooltip is a no-op when nothing is mounted', () => {
    expect(() => hideTooltip()).not.toThrow();
  });
});
