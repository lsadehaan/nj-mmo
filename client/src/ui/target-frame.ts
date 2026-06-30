import { attachToRightRail, RIGHT_RAIL_ORDER } from './hud-rail';

export interface TargetMobView {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  level?: number;
  aggroTargetSessionId?: string;
  aggroTargetName?: string;
}

export interface TargetPlayerView {
  sessionId: string;
  name: string;
  hp: number;
  maxHp: number;
  level?: number;
  pvpFlag?: number;
  karma?: number;
  targetMobId?: string | null;
  targetMobName?: string | null;
  targetPlayerSessionId?: string | null;
  targetPlayerName?: string | null;
}

export interface TargetFrameHandlers {
  onInvite?: (sessionId: string) => void;
  onTrade?: (sessionId: string) => void;
}

export function mountTargetFrame(handlers: TargetFrameHandlers = {}): HTMLElement {
  let frame = document.getElementById('target-frame');
  if (frame) return frame;

  frame = document.createElement('div');
  frame.id = 'target-frame';
  frame.hidden = true;
  frame.style.cssText =
    'min-width:180px;padding:8px;background:rgba(0,0,0,0.75);color:#fff;border:1px solid #666;border-radius:4px';

  const tot = document.createElement('div');
  tot.id = 'target-of-target';
  tot.hidden = true;
  tot.style.cssText = 'margin-top:6px;font-size:12px;opacity:0.85';
  frame.appendChild(tot);

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.dataset['role'] = 'target-context';
  menuBtn.textContent = '▾';
  menuBtn.hidden = true;
  frame.appendChild(menuBtn);

  const menu = document.createElement('div');
  menu.dataset['role'] = 'target-context-menu';
  menu.hidden = true;
  const invite = document.createElement('button');
  invite.type = 'button';
  invite.dataset['action'] = 'invite';
  invite.textContent = 'Invite';
  invite.addEventListener('click', () => {
    const sid = frame?.dataset['targetSessionId'];
    if (sid) handlers.onInvite?.(sid);
  });
  menu.append(invite);
  frame.appendChild(menu);

  menuBtn.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
  });

  attachToRightRail(frame, RIGHT_RAIL_ORDER.target);
  return frame;
}

export function renderTargetFrame(options: {
  mob?: TargetMobView | null;
  player?: TargetPlayerView | null;
}): void {
  const frame = mountTargetFrame();
  const tot = document.getElementById('target-of-target')!;
  frame.innerHTML = '';
  frame.appendChild(tot);

  if (options.mob) {
    frame.hidden = false;
    delete frame.dataset['targetSessionId'];
    const hpPct = options.mob.maxHp > 0 ? (options.mob.hp / options.mob.maxHp) * 100 : 0;
    const lvl =
      options.mob.level && options.mob.level > 0
        ? `<span data-role="target-level" style="opacity:0.8">Lv.${options.mob.level} </span>`
        : '';
    frame.innerHTML = `<div data-role="target-name">${lvl}${options.mob.name}</div><div data-role="target-hp-bar" style="height:6px;background:#333"><div style="width:${hpPct}%;height:100%;background:#c33"></div></div>`;
    frame.appendChild(tot);
    if (options.mob.aggroTargetName) {
      tot.hidden = false;
      tot.textContent = `→ ${options.mob.aggroTargetName}`;
    } else {
      tot.hidden = true;
    }
    return;
  }

  if (options.player) {
    frame.hidden = false;
    frame.dataset['targetSessionId'] = options.player.sessionId;
    const hpPct = options.player.maxHp > 0 ? (options.player.hp / options.player.maxHp) * 100 : 0;
    const pvp =
      options.player.pvpFlag || options.player.karma
        ? `<span data-pvp-flag="${options.player.pvpFlag ?? 0}">PvP</span>`
        : '';
    frame.innerHTML = `<div data-role="target-name">${options.player.name} ${pvp}</div><div data-role="target-hp-bar" style="height:6px;background:#333"><div style="width:${hpPct}%;height:100%;background:#c33"></div></div>`;
    frame.appendChild(tot);
    const totName = options.player.targetMobName ?? options.player.targetPlayerName;
    if (totName) {
      tot.hidden = false;
      tot.textContent = `→ ${totName}`;
    } else {
      tot.hidden = true;
    }
    const menuBtn = document.createElement('button');
    menuBtn.dataset['role'] = 'target-context';
    menuBtn.textContent = '▾';
    const menu = document.createElement('div');
    menu.dataset['role'] = 'target-context-menu';
    const invite = document.createElement('button');
    invite.dataset['action'] = 'invite';
    invite.textContent = 'Invite';
    invite.addEventListener('click', () => {
      window.__partyInvite__?.(options.player!.sessionId);
    });
    menu.append(invite);
    frame.append(menuBtn, menu);
    return;
  }

  frame.hidden = true;
  tot.hidden = true;
}

export function wireTargetContextMenu(handlers: TargetFrameHandlers): void {
  mountTargetFrame(handlers);
}
