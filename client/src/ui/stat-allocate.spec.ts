import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountStatAllocate, wireStatAllocate } from './stat-allocate';

describe('stat-allocate', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('wires allocateStat and resetStats', () => {
    const calls: string[] = [];
    wireStatAllocate({
      allocateStat: (s) => calls.push(`alloc:${s}`),
      resetStats: () => calls.push('reset'),
    });
    const panel = mountStatAllocate();
    (panel.querySelector('[data-stat="str"]') as HTMLButtonElement).click();
    (panel.querySelector('[data-role="reset"]') as HTMLButtonElement).click();
    expect(calls).toEqual(['alloc:str', 'reset']);
  });
});
