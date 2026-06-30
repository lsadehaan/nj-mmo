import { isInMeleeRange } from '../combat/combat-range';

export const CHAT_MAX_LENGTH = 120;
export const CHAT_RATE_LIMIT_COUNT = 5;
export const CHAT_RATE_LIMIT_WINDOW_MS = 10_000;
export const LOCAL_CHAT_RANGE = 30;

export type ChatChannel = 'all' | 'local' | 'trade' | 'party';

const VALID_CHANNELS = new Set<ChatChannel>(['all', 'local', 'trade', 'party']);

export interface ChatRateState {
  timestampsMs: number[];
}

export function createChatRateState(): ChatRateState {
  return { timestampsMs: [] };
}

export function isInChatRange(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  range = LOCAL_CHAT_RANGE
): boolean {
  return isInMeleeRange(ax, az, bx, bz, range);
}

function stripControlChars(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export type ChatValidationResult =
  | { ok: true; text: string; channel: ChatChannel }
  | { ok: false; error: string };

export function validateChatMessage(
  input: { channel: string; text: string },
  rateState: ChatRateState,
  nowMs: number
): ChatValidationResult {
  if (!VALID_CHANNELS.has(input.channel as ChatChannel)) {
    return { ok: false, error: 'unknown_channel' };
  }

  const trimmed = stripControlChars(input.text).trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'empty_text' };
  }
  if (trimmed.length > CHAT_MAX_LENGTH) {
    return { ok: false, error: 'text_too_long' };
  }

  const windowStart = nowMs - CHAT_RATE_LIMIT_WINDOW_MS;
  rateState.timestampsMs = rateState.timestampsMs.filter((t) => t > windowStart);
  if (rateState.timestampsMs.length >= CHAT_RATE_LIMIT_COUNT) {
    return { ok: false, error: 'rate_limited' };
  }

  rateState.timestampsMs.push(nowMs);
  return { ok: true, text: trimmed, channel: input.channel as ChatChannel };
}
