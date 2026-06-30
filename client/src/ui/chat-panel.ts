export type ChatChannel = 'all' | 'local' | 'trade' | 'party';

export interface ChatSendHandlers {
  sendChat: (payload: { channel: ChatChannel; text: string }) => void;
}

const ELEMENT_ID = 'chat-panel';

export function mountChatPanel(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;
  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.style.cssText =
    'position:fixed;bottom:8px;left:8px;width:320px;background:rgba(0,0,0,0.75);color:#fff;padding:8px;font:12px sans-serif;z-index:50';
  panel.innerHTML =
    '<select data-role="channel"><option value="all">All</option><option value="local">Local</option><option value="trade">Trade</option><option value="party">Party</option></select><input data-role="input" style="width:55%" /><button data-role="send">Send</button><div data-role="log" style="max-height:120px;overflow:auto;margin-top:4px"></div>';
  document.body.appendChild(panel);
  return panel;
}

export function wireChatPanel(handlers: ChatSendHandlers): void {
  const panel = mountChatPanel();
  const sendBtn = panel.querySelector('[data-role="send"]') as HTMLButtonElement;
  const input = panel.querySelector('[data-role="input"]') as HTMLInputElement;
  const channel = panel.querySelector('[data-role="channel"]') as HTMLSelectElement;
  sendBtn.onclick = () => {
    const text = input.value.trim();
    if (!text) return;
    handlers.sendChat({ channel: channel.value as ChatChannel, text });
    input.value = '';
  };
}

export function renderChatLog(
  lines: { channel: string; senderName: string; text: string }[]
): void {
  const panel = mountChatPanel();
  const log = panel.querySelector('[data-role="log"]')!;
  log.innerHTML = lines
    .map((l) => `<div>[${l.channel}] ${l.senderName}: ${l.text}</div>`)
    .join('');
}
