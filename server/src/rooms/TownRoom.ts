import { Room, Client } from 'colyseus';
import {
  step,
  createInitialMoveState,
  isValidMoveIntent,
  type MovementIntent,
  type PlayerMoveState,
  SPAWN_X,
  SPAWN_Y,
  SPAWN_Z,
} from '@nj/game-core';
import { TownState, PlayerState } from './schema/TownState';

export interface TownRoomOptions {
  dbPath?: string;
}

export class TownRoom extends Room<{ state: TownState }> {
  declare state: TownState;

  private tickStates = new Map<string, PlayerMoveState>();
  private pendingIntents = new Map<string, MovementIntent>();

  override onCreate(_options: TownRoomOptions = {}): void {
    this.setState(new TownState());
    this.autoDispose = true;
    this.setSimulationInterval((deltaTimeMs) => this.simulate(deltaTimeMs), 50);

    this.onMessage('move', (client, message: { targetX: number; targetZ: number }) => {
      if (!isValidMoveIntent(message.targetX, message.targetZ)) return;
      this.pendingIntents.set(client.sessionId, {
        targetX: message.targetX,
        targetZ: message.targetZ,
      });
    });
  }

  private simulate(deltaTimeMs: number): void {
    const dt = deltaTimeMs / 1000;
    for (const [sessionId, player] of this.state.players.entries()) {
      const intent = this.pendingIntents.get(sessionId) ?? null;
      this.pendingIntents.delete(sessionId);
      const tickState = this.tickStates.get(sessionId);
      if (!tickState) continue;

      const next = step(tickState, intent, dt);
      this.tickStates.set(sessionId, next);
      player.x = next.x;
      player.z = next.z;
    }
  }

  override onJoin(client: Client): void {
    const player = new PlayerState();
    player.x = SPAWN_X;
    player.y = SPAWN_Y;
    player.z = SPAWN_Z;
    player.hp = 100;
    player.mp = 50;
    player.xp = 0;
    player.level = 1;
    player.connected = true;
    this.state.players.set(client.sessionId, player);
    this.tickStates.set(
      client.sessionId,
      createInitialMoveState(SPAWN_X, SPAWN_Y, SPAWN_Z)
    );
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.tickStates.delete(client.sessionId);
    this.pendingIntents.delete(client.sessionId);
  }
}
