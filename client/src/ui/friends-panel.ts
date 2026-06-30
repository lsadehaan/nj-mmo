import { attachToRightRail, RIGHT_RAIL_ORDER } from './hud-rail';

export interface FriendsSendHandlers {
  sendFriendAdd: (payload: { targetSessionId: string }) => void;
  sendFriendRemove: (payload: { friendCharacterId: string }) => void;
}

const ELEMENT_ID = 'friends-panel';

export function mountFriendsPanel(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;
  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.style.cssText =
    'background:rgba(0,0,0,0.75);color:#fff;padding:8px;font:12px sans-serif;border-radius:4px;min-width:160px';
  panel.innerHTML =
    '<div data-role="title" style="font-weight:bold;margin-bottom:4px">Friends</div>' +
    '<ul data-role="list" style="list-style:none;margin:0 0 6px;padding:0"></ul>' +
    '<div style="display:flex;gap:4px">' +
    '<input data-role="add-target" placeholder="session id" style="flex:1;min-width:0" />' +
    '<button data-role="add">Add</button></div>';
  attachToRightRail(panel, RIGHT_RAIL_ORDER.friends);
  return panel;
}

export function wireFriendsPanel(handlers: FriendsSendHandlers): void {
  const panel = mountFriendsPanel();
  (panel.querySelector('[data-role="add"]') as HTMLButtonElement).onclick = () => {
    const target = (panel.querySelector('[data-role="add-target"]') as HTMLInputElement).value;
    if (target) handlers.sendFriendAdd({ targetSessionId: target });
  };
}

export function renderFriendsPanel(
  friends: { characterId: string; name: string; online: boolean }[]
): void {
  const panel = mountFriendsPanel();
  const list = panel.querySelector('[data-role="list"]')!;
  list.innerHTML = friends
    .map((f) => `<li>${f.name} ${f.online ? '(online)' : '(offline)'}</li>`)
    .join('');
}
