import { Room, Client } from 'colyseus';
import {
  step,
  createInitialMoveState,
  isValidMoveIntent,
  type MovementIntent,
  type PlayerMoveState,
} from '@nj/game-core';
import { getDb, type AppDatabase } from '../db/client';
import { createCharacter, loadCharacter } from '../db/character-repository';
import type { Character } from '../db/schema';
import { TownState, PlayerState } from './schema/TownState';

export interface TownRoomOptions {
  dbPath?: string;
}

const DEFAULT_DB_PATH = process.env['NJ_DB_PATH'] ?? 'data/game.db';

export class TownRoom extends Room<{ state: TownState }> {
  declare state: TownState;

  private db!: AppDatabase;
  private tickStates = new Map<string, PlayerMoveState>();
  private pendingIntents = new Map<string, MovementIntent>();
  private characterIds = new Map<string, string>();
  private characters = new Map<string, Character>();

  override onCreate(options: TownRoomOptions = {}): void {
    this.db = getDb(options.dbPath ?? DEFAULT_DB_PATH);
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

  override onJoin(client: Client, options: { characterId?: string } = {}): void {
    let character: Character;
    if (options.characterId) {
      character = loadCharacter(this.db, options.characterId) ?? createCharacter(this.db);
    } else {
      character = createCharacter(this.db);
    }

    this.characterIds.set(client.sessionId, character.id);
    this.characters.set(client.sessionId, character);
    client.userData = { characterId: character.id };

    const player = new PlayerState();
    player.x = character.x;
    player.y = character.y;
    player.z = character.z;
    player.hp = character.hp;
    player.mp = character.mp;
    player.xp = character.xp;
    player.level = character.level;
    player.connected = true;
    this.state.players.set(client.sessionId, player);
    this.tickStates.set(
      client.sessionId,
      createInitialMoveState(character.x, character.y, character.z)
    );

    client.send('characterId', character.id);
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.tickStates.delete(client.sessionId);
    this.pendingIntents.delete(client.sessionId);
    this.characterIds.delete(client.sessionId);
    this.characters.delete(client.sessionId);
  }
}
