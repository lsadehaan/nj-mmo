import {
  executeTradeSwap,
  horizontalDistance,
  validateTradeOffer,
  type TradeOffer,
} from '@nj/game-core';
import type { EquipmentRow } from '../db/equipment-repository';
import type { CharacterItemCounts } from '../db/character-repository';
import type { PlayerState } from './schema/TownState';

export const TRADE_RANGE = 3;

export interface TradeSession {
  id: string;
  sessionA: string;
  sessionB: string;
  offerA: TradeOffer | null;
  offerB: TradeOffer | null;
  confirmedA: boolean;
  confirmedB: boolean;
}

export interface TradeHandlerDeps {
  tradeSessions: Map<string, TradeSession>;
  tradeSessionByPlayer: Map<string, string>;
  getPlayer: (sessionId: string) => PlayerState | undefined;
  getItems: (sessionId: string) => CharacterItemCounts;
  setItems: (sessionId: string, items: CharacterItemCounts) => void;
  getEquipment: (sessionId: string) => EquipmentRow[];
  isQuestItem: (itemId: number) => boolean;
  sendTo: (sessionId: string, type: string, payload: unknown) => void;
  syncItems: (sessionId: string) => void;
  persist: (sessionId: string) => void;
  nowMs: () => number;
}

function isInTradeRange(a: PlayerState, b: PlayerState): boolean {
  return horizontalDistance(a.x, a.z, b.x, b.z) <= TRADE_RANGE;
}

function getSessionForPlayer(deps: TradeHandlerDeps, sessionId: string): TradeSession | undefined {
  const tradeId = deps.tradeSessionByPlayer.get(sessionId);
  if (!tradeId) return undefined;
  return deps.tradeSessions.get(tradeId);
}

function equipmentSlots(rows: EquipmentRow[]): Record<string, number> {
  const slots: Record<string, number> = {};
  for (const row of rows) {
    slots[row.slot] = row.itemId;
  }
  return slots;
}

export function clearTradeSession(deps: TradeHandlerDeps, trade: TradeSession): void {
  deps.tradeSessions.delete(trade.id);
  deps.tradeSessionByPlayer.delete(trade.sessionA);
  deps.tradeSessionByPlayer.delete(trade.sessionB);
  deps.sendTo(trade.sessionA, 'tradeClosed', {});
  deps.sendTo(trade.sessionB, 'tradeClosed', {});
}

export function handleTradeRequest(
  deps: TradeHandlerDeps,
  fromSessionId: string,
  targetSessionId: string
): void {
  if (fromSessionId === targetSessionId) return;
  if (getSessionForPlayer(deps, fromSessionId) || getSessionForPlayer(deps, targetSessionId)) return;

  const from = deps.getPlayer(fromSessionId);
  const target = deps.getPlayer(targetSessionId);
  if (!from || !target) return;
  if (from.partyId !== 0 || target.partyId !== 0) return;
  if (!isInTradeRange(from, target)) return;

  deps.sendTo(targetSessionId, 'tradeRequest', { fromSessionId, fromName: from.characterName });
}

export function handleTradeAccept(
  deps: TradeHandlerDeps,
  acceptorSessionId: string,
  fromSessionId: string
): void {
  if (getSessionForPlayer(deps, acceptorSessionId) || getSessionForPlayer(deps, fromSessionId)) return;

  const acceptor = deps.getPlayer(acceptorSessionId);
  const from = deps.getPlayer(fromSessionId);
  if (!acceptor || !from) return;
  if (!isInTradeRange(acceptor, from)) return;

  const tradeId = `${fromSessionId}:${acceptorSessionId}:${deps.nowMs()}`;
  const trade: TradeSession = {
    id: tradeId,
    sessionA: fromSessionId,
    sessionB: acceptorSessionId,
    offerA: null,
    offerB: null,
    confirmedA: false,
    confirmedB: false,
  };
  deps.tradeSessions.set(tradeId, trade);
  deps.tradeSessionByPlayer.set(fromSessionId, tradeId);
  deps.tradeSessionByPlayer.set(acceptorSessionId, tradeId);

  const openPayload = { status: 'open', partnerSessionId: acceptorSessionId };
  const openPayloadB = { status: 'open', partnerSessionId: fromSessionId };
  deps.sendTo(fromSessionId, 'tradeOpen', openPayload);
  deps.sendTo(acceptorSessionId, 'tradeOpen', openPayloadB);
}

export function handleTradeOffer(
  deps: TradeHandlerDeps,
  sessionId: string,
  offer: TradeOffer
): void {
  const trade = getSessionForPlayer(deps, sessionId);
  if (!trade) return;

  const player = deps.getPlayer(sessionId);
  if (!player) return;
  const partnerId = trade.sessionA === sessionId ? trade.sessionB : trade.sessionA;
  const partner = deps.getPlayer(partnerId);
  if (!partner || !isInTradeRange(player, partner)) return;

  const validation = validateTradeOffer(
    offer,
    deps.getItems(sessionId),
    player.adena,
    { slots: equipmentSlots(deps.getEquipment(sessionId)) },
    deps.isQuestItem
  );
  if (!validation.ok) {
    deps.sendTo(sessionId, 'tradeError', { error: validation.error });
    return;
  }

  if (trade.sessionA === sessionId) {
    trade.offerA = offer;
    trade.confirmedA = false;
  } else {
    trade.offerB = offer;
    trade.confirmedB = false;
  }
  trade.confirmedA = false;
  trade.confirmedB = false;

  deps.sendTo(partnerId, 'tradePartnerOffer', { offer });
  deps.sendTo(sessionId, 'tradeOfferAck', { offer });
}

export function handleTradeConfirm(deps: TradeHandlerDeps, sessionId: string): void {
  const trade = getSessionForPlayer(deps, sessionId);
  if (!trade || !trade.offerA || !trade.offerB) return;

  const playerA = deps.getPlayer(trade.sessionA);
  const playerB = deps.getPlayer(trade.sessionB);
  if (!playerA || !playerB) return;
  if (!isInTradeRange(playerA, playerB)) {
    deps.sendTo(sessionId, 'tradeError', { error: 'out_of_range' });
    return;
  }

  if (trade.sessionA === sessionId) trade.confirmedA = true;
  else trade.confirmedB = true;

  if (!trade.confirmedA || !trade.confirmedB) return;

  const itemsA = deps.getItems(trade.sessionA);
  const itemsB = deps.getItems(trade.sessionB);

  const valA = validateTradeOffer(
    trade.offerA,
    itemsA,
    playerA.adena,
    { slots: equipmentSlots(deps.getEquipment(trade.sessionA)) },
    deps.isQuestItem
  );
  const valB = validateTradeOffer(
    trade.offerB,
    itemsB,
    playerB.adena,
    { slots: equipmentSlots(deps.getEquipment(trade.sessionB)) },
    deps.isQuestItem
  );
  if (!valA.ok || !valB.ok) {
    clearTradeSession(deps, trade);
    return;
  }

  const swapped = executeTradeSwap(
    { inventory: itemsA, adena: playerA.adena },
    trade.offerA,
    { inventory: itemsB, adena: playerB.adena },
    trade.offerB
  );
  if (!swapped) {
    clearTradeSession(deps, trade);
    return;
  }

  deps.setItems(trade.sessionA, swapped.inventoryA);
  deps.setItems(trade.sessionB, swapped.inventoryB);
  playerA.adena = swapped.adenaA;
  playerB.adena = swapped.adenaB;

  deps.syncItems(trade.sessionA);
  deps.syncItems(trade.sessionB);
  deps.persist(trade.sessionA);
  deps.persist(trade.sessionB);

  deps.sendTo(trade.sessionA, 'tradeComplete', {});
  deps.sendTo(trade.sessionB, 'tradeComplete', {});
  deps.tradeSessions.delete(trade.id);
  deps.tradeSessionByPlayer.delete(trade.sessionA);
  deps.tradeSessionByPlayer.delete(trade.sessionB);
}

export function handleTradeCancel(deps: TradeHandlerDeps, sessionId: string): void {
  const trade = getSessionForPlayer(deps, sessionId);
  if (!trade) return;
  clearTradeSession(deps, trade);
}

export function cleanupTradeOnDisconnect(deps: TradeHandlerDeps, sessionId: string): void {
  const trade = getSessionForPlayer(deps, sessionId);
  if (!trade) return;
  clearTradeSession(deps, trade);
}
