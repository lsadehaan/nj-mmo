import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountChatPanel, wireChatPanel } from './chat-panel';

describe('chat-panel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('submit sends chat intent via handler', () => {
    const sendChat = vi.fn();
    wireChatPanel({ sendChat });
    const input = document.querySelector('[data-role="input"]') as HTMLInputElement;
    input.value = 'hello';
    (document.querySelector('[data-role="send"]') as HTMLButtonElement).click();
    expect(sendChat).toHaveBeenCalledWith({ channel: 'all', text: 'hello' });
  });
});
