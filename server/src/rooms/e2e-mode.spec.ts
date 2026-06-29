import { describe, it, expect, afterEach } from 'vitest';
import { isE2EMode } from './e2e-mode';

describe('isE2EMode', () => {
  const original = process.env['NJ_E2E'];

  afterEach(() => {
    if (original === undefined) delete process.env['NJ_E2E'];
    else process.env['NJ_E2E'] = original;
  });

  it('returns true when NJ_E2E=1', () => {
    process.env['NJ_E2E'] = '1';
    expect(isE2EMode()).toBe(true);
  });

  it('returns false when NJ_E2E is unset', () => {
    delete process.env['NJ_E2E'];
    expect(isE2EMode()).toBe(false);
  });

  it('returns false when NJ_E2E=0', () => {
    process.env['NJ_E2E'] = '0';
    expect(isE2EMode()).toBe(false);
  });
});
