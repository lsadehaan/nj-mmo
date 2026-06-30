import { attachToRightRail, RIGHT_RAIL_ORDER } from './hud-rail';

export interface PartyMemberView {
  sessionId: string;
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  isLeader: boolean;
}

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
    'display:flex;flex-direction:column;align-items:flex-end;gap:4px;' +
    'background:rgba(0,0,0,0.6);color:#fff;padding:8px;border-radius:4px;font:12px sans-serif';
  panel.innerHTML = '<div data-role="members"></div><button data-role="leave">Leave</button>';
  attachToRightRail(panel, RIGHT_RAIL_ORDER.party);
  return panel;
}

export function wirePartyPanel(handlers: PartySendHandlers): void {
  const panel = mountPartyPanel();
  (panel.querySelector('[data-role="leave"]') as HTMLButtonElement).onclick = () => {
    handlers.sendPartyLeave();
  };
}

export function renderPartyPanel(members: PartyMemberView[]): void {
  const panel = mountPartyPanel();
  const container = panel.querySelector('[data-role="members"]')!;
  container.innerHTML = '';

  if (members.length === 0) {
    const empty = document.createElement('div');
    empty.dataset['role'] = 'party-empty';
    empty.textContent = 'Solo';
    container.appendChild(empty);
    return;
  }

  for (const member of members) {
    const frame = document.createElement('div');
    frame.dataset['role'] = 'party-member';
    frame.dataset['sessionId'] = member.sessionId;
    if (member.isLeader) frame.dataset['partyLeader'] = 'true';

    const hpPct = member.maxHp > 0 ? (member.hp / member.maxHp) * 100 : 0;
    const mpPct = member.maxMp > 0 ? (member.mp / member.maxMp) * 100 : 0;

    frame.innerHTML = `
      <div data-role="party-member-name">${member.name}</div>
      <div data-role="party-hp-bar" style="height:4px;background:#333;width:120px">
        <div data-role="party-hp-fill" style="height:100%;width:${hpPct}%;background:#3a3"></div>
      </div>
      <div data-role="party-mp-bar" style="height:4px;background:#333;width:120px">
        <div data-role="party-mp-fill" style="height:100%;width:${mpPct}%;background:#33a"></div>
      </div>`;
    container.appendChild(frame);
  }
}
