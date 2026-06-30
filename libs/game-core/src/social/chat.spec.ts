import { describe, it, expect } from 'vitest';
import {
  validateChatMessage,
  createChatRateState,
  CHAT_MAX_LENGTH,
  CHAT_RATE_LIMIT_COUNT,
  CHAT_RATE_LIMIT_WINDOW_MS,
  isInChatRange,
  LOCAL_CHAT_RANGE,
} from './chat';

describe('validateChatMessage (SOC26-05–07, SOC26-40)', () => {
  it('SOC26-06: rejects empty or whitespace-only text', () => {
    const state = createChatRateState();
    expect(validateChatMessage({ channel: 'all', text: '' }, state, 0).ok).toBe(false);
    expect(validateChatMessage({ channel: 'all', text: '   ' }, state, 0).ok).toBe(false);
  });

  it('SOC26-07: rejects text longer than 120 chars', () => {
    const state = createChatRateState();
    const long = 'a'.repeat(CHAT_MAX_LENGTH + 1);
    expect(validateChatMessage({ channel: 'all', text: long }, state, 0).ok).toBe(false);
  });

  it('SOC26-05: rejects 6th message within 10s window', () => {
    const state = createChatRateState();
    const now = 1000;
    for (let i = 0; i < CHAT_RATE_LIMIT_COUNT; i++) {
      const result = validateChatMessage({ channel: 'all', text: `msg${i}` }, state, now);
      expect(result.ok).toBe(true);
    }
    const sixth = validateChatMessage({ channel: 'all', text: 'spam' }, state, now);
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.error).toBe('rate_limited');
  });

  it('SOC26-05: allows message after window slides', () => {
    const state = createChatRateState();
    const start = 0;
    for (let i = 0; i < CHAT_RATE_LIMIT_COUNT; i++) {
      validateChatMessage({ channel: 'all', text: `msg${i}` }, state, start + i * 100);
    }
    const afterWindow = validateChatMessage(
      { channel: 'all', text: 'ok' },
      state,
      start + CHAT_RATE_LIMIT_WINDOW_MS + 1
    );
    expect(afterWindow.ok).toBe(true);
  });

  it('SOC26-40: rejects unknown channel', () => {
    const state = createChatRateState();
    const result = validateChatMessage({ channel: 'whisper', text: 'hi' }, state, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unknown_channel');
  });

  it('strips control characters before broadcast', () => {
    const state = createChatRateState();
    const result = validateChatMessage({ channel: 'all', text: 'hello\x07world' }, state, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe('helloworld');
  });
});

describe('isInChatRange', () => {
  it('returns true within local chat range', () => {
    expect(isInChatRange(0, 0, 20, 0, LOCAL_CHAT_RANGE)).toBe(true);
  });

  it('returns false beyond local chat range', () => {
    expect(isInChatRange(0, 0, 35, 0, LOCAL_CHAT_RANGE)).toBe(false);
  });
});
