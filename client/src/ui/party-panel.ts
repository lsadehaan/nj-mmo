export interface PartySendHandlers {
  sendPartyInvite: (payload: { targetSessionId: string }) => void;
  sendPartyLeave: () => void;
}

const ELEMENT_ID = 'party-panel';

export function mountPartyPanel(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;
  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.style.cssText =
    'position:fixed;top:8px;right:8px;background:rgba(0,0,0,0.75);color:#fff;padding:8px;font:12px sans-serif;z-index:50';
  panel.innerHTML =
    '<div data-role="members"></div><input data-role="invite-target" placeholder="session id" /><button data-role="invite">Invite</button><button data-role="leave">Leave</button>';
  document.body.appendChild(panel);
  return panel;
}

export function wirePartyPanel(handlers: PartySendHandlers): void {
  const panel = mountPartyPanel();
  (panel.querySelector('[data-role="invite"]') as HTMLButtonElement).onclick = () => {
    const target = (panel.querySelector('[data-role="invite-target"]') as HTMLInputElement).value;
    if (target) handlers.sendPartyInvite({ targetSessionId: target });
  };
  (panel.querySelector('[data-role="leave"]') as HTMLButtonElement).onclick = () => {
    handlers.sendPartyLeave();
  };
}

export function renderPartyPanel(members: string[], leaderSessionId: string): void {
  const panel = mountPartyPanel();
  const el = panel.querySelector('[data-role="members"]')!;
  el.textContent = members.length
    ? `Party (${leaderSessionId === members[0] ? 'leader' : 'member'}): ${members.join(', ')}`
    : 'No party';
}
