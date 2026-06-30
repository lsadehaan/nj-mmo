import {
  canInvitePartyTarget,
  horizontalDistance,
  PARTY_RANGE_WORLD,
} from '@nj/game-core';
import { PartyState } from './schema/PartyState';
import type { PlayerState, TownState } from './schema/TownState';

export const PARTY_MAX_SIZE = 5;
export const PARTY_INVITE_RANGE = PARTY_RANGE_WORLD;

export interface PartyInvitePending {
  inviterSessionId: string;
  inviterName: string;
}

export interface PartyHandlerDeps {
  state: TownState;
  pendingInvites: Map<string, PartyInvitePending>;
  partyMemberOrder: Map<number, string[]>;
  allocPartyId: () => number;
  getPlayer: (sessionId: string) => PlayerState | undefined;
  sendTo: (sessionId: string, type: string, payload: unknown) => void;
}

function isWithinPartyRange(a: PlayerState, b: PlayerState): boolean {
  return horizontalDistance(a.x, a.z, b.x, b.z) <= PARTY_INVITE_RANGE;
}

function syncPartyId(deps: PartyHandlerDeps, sessionId: string, partyId: number): void {
  const player = deps.getPlayer(sessionId);
  if (player) player.partyId = partyId;
}

function getParty(deps: PartyHandlerDeps, partyId: number): PartyState | undefined {
  return deps.state.parties.get(String(partyId));
}

export function handlePartyInvite(
  deps: PartyHandlerDeps,
  inviterSessionId: string,
  targetSessionId: string
): void {
  if (!canInvitePartyTarget(inviterSessionId, targetSessionId)) return;

  const inviter = deps.getPlayer(inviterSessionId);
  const target = deps.getPlayer(targetSessionId);
  if (!inviter || !target) return;
  if (inviter.partyId !== 0 && !isPartyLeader(deps, inviterSessionId)) return;
  if (target.partyId !== 0) return;
  if (!isWithinPartyRange(inviter, target)) return;

  const party = inviter.partyId !== 0 ? getParty(deps, inviter.partyId) : undefined;
  if (party && party.memberSessionIds.length >= PARTY_MAX_SIZE) return;
  if (party && !party.memberSessionIds.includes(inviterSessionId)) return;
  if (!party && inviter.partyId !== 0) return;

  deps.pendingInvites.set(targetSessionId, {
    inviterSessionId,
    inviterName: inviter.characterName,
  });
  deps.sendTo(targetSessionId, 'partyInvite', {
    inviterSessionId,
    inviterName: inviter.characterName,
  });
}

export function handlePartyAccept(
  deps: PartyHandlerDeps,
  targetSessionId: string,
  inviterSessionId: string
): void {
  const pending = deps.pendingInvites.get(targetSessionId);
  if (!pending || pending.inviterSessionId !== inviterSessionId) return;

  const inviter = deps.getPlayer(inviterSessionId);
  const target = deps.getPlayer(targetSessionId);
  if (!inviter || !target || target.partyId !== 0) return;
  if (!isWithinPartyRange(inviter, target)) return;

  deps.pendingInvites.delete(targetSessionId);

  let partyId = inviter.partyId;
  if (partyId === 0) {
    partyId = deps.allocPartyId();
    const party = new PartyState();
    party.id = partyId;
    party.leaderSessionId = inviterSessionId;
    party.memberSessionIds.push(inviterSessionId);
    deps.state.parties.set(String(partyId), party);
    syncPartyId(deps, inviterSessionId, partyId);
    deps.partyMemberOrder.set(partyId, [inviterSessionId]);
  }

  const party = getParty(deps, partyId)!;
  if (party.memberSessionIds.length >= PARTY_MAX_SIZE) return;
  if (party.memberSessionIds.includes(targetSessionId)) return;

  party.memberSessionIds.push(targetSessionId);
  syncPartyId(deps, targetSessionId, partyId);
  const order = deps.partyMemberOrder.get(partyId) ?? [];
  order.push(targetSessionId);
  deps.partyMemberOrder.set(partyId, order);
}

export function handlePartyDecline(
  deps: PartyHandlerDeps,
  targetSessionId: string,
  inviterSessionId: string
): void {
  const pending = deps.pendingInvites.get(targetSessionId);
  if (!pending || pending.inviterSessionId !== inviterSessionId) return;
  deps.pendingInvites.delete(targetSessionId);
  deps.sendTo(inviterSessionId, 'partyDecline', { targetSessionId });
}

export function handlePartyLeave(deps: PartyHandlerDeps, sessionId: string): void {
  const player = deps.getPlayer(sessionId);
  if (!player || player.partyId === 0) return;
  removeFromParty(deps, sessionId, player.partyId);
}

export function handlePartyKick(
  deps: PartyHandlerDeps,
  leaderSessionId: string,
  targetSessionId: string
): void {
  const party = getPartyForSession(deps, leaderSessionId);
  if (!party || party.leaderSessionId !== leaderSessionId) return;
  if (targetSessionId === leaderSessionId) return;
  const player = deps.getPlayer(targetSessionId);
  if (!player || player.partyId !== party.id) return;
  removeFromParty(deps, targetSessionId, party.id);
}

function getPartyForSession(deps: PartyHandlerDeps, sessionId: string): PartyState | undefined {
  const player = deps.getPlayer(sessionId);
  if (!player || player.partyId === 0) return undefined;
  return getParty(deps, player.partyId);
}

function isPartyLeader(deps: PartyHandlerDeps, sessionId: string): boolean {
  const party = getPartyForSession(deps, sessionId);
  return party?.leaderSessionId === sessionId;
}

function removeFromParty(deps: PartyHandlerDeps, sessionId: string, partyId: number): void {
  const party = getParty(deps, partyId);
  if (!party) return;

  const wasLeader = party.leaderSessionId === sessionId;
  const idx = party.memberSessionIds.indexOf(sessionId);
  if (idx >= 0) {
    party.memberSessionIds.splice(idx, 1);
  }
  syncPartyId(deps, sessionId, 0);
  deps.pendingInvites.delete(sessionId);

  const order = deps.partyMemberOrder.get(partyId) ?? [];
  const orderIdx = order.indexOf(sessionId);
  if (orderIdx >= 0) order.splice(orderIdx, 1);
  deps.partyMemberOrder.set(partyId, order);

  if (party.memberSessionIds.length === 0) {
    deps.state.parties.delete(String(partyId));
    deps.partyMemberOrder.delete(partyId);
    return;
  }

  if (wasLeader) {
    const nextLeader = order[0] ?? party.memberSessionIds[0]!;
    party.leaderSessionId = nextLeader;
  }
}

export function cleanupPartyOnDisconnect(deps: PartyHandlerDeps, sessionId: string): void {
  deps.pendingInvites.delete(sessionId);
  handlePartyLeave(deps, sessionId);
}

export function getPartyMemberSessionIds(deps: PartyHandlerDeps, partyId: number): string[] {
  const order = deps.partyMemberOrder.get(partyId);
  if (order && order.length > 0) return [...order];
  const party = getParty(deps, partyId);
  if (!party) return [];
  const ids: string[] = [];
  for (let i = 0; i < party.memberSessionIds.length; i++) {
    const id = party.memberSessionIds[i];
    if (id) ids.push(id);
  }
  return ids;
}
