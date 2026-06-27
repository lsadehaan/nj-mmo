import { Room, Client } from 'colyseus';
import {
  step,
  createInitialMoveState,
  isValidMoveIntent,
  type MovementIntent,
  type PlayerMoveState,
} from '@nj/game-core';
import { getDb, type AppDatabase } from '../db/client';
import {
  createCharacter,
  loadCharacter,
  saveCharacter,
} from '../db/character-repository';
import type { Character } from '../db/schema';
import { TownState, PlayerState } from './schema/TownState';

export interface TownRoomOptions {
  dbPath?: string;
  saveDebounceMs?: number;
}

const DEFAULT_DB_PATH = process.env['NJ_DB_PATH'] ?? 'data/game.db';
const DEFAULT_SAVE_DEBOUNCE_MS = 5000;

export class TownRoom extends Room<{ state: TownState }> {
  declare state: TownState;

  private db!: AppDatabase;
  private saveDebounceMs = DEFAULT_SAVE_DEBOUNCE_MS;
  private tickStates = new Map<string, PlayerMoveState>();
  private pendingIntents = new Map<string, MovementIntent>();
  private characterIds = new Map<string, string>();
  private characters = new Map<string, Character>();
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  override onCreate(options: TownRoomOptions = {}): void {
    this.db = getDb(options.dbPath ?? DEFAULT_DB_PATH);
    this.saveDebounceMs = options.saveDebounceMs ?? DEFAULT_SAVE_DEBOUNCE_MS;
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

      const beforeX = player.x;
      const beforeZ = player.z;
      const next = step(tickState, intent, dt);
      this.tickStates.set(sessionId, next);
      player.x = next.x;
      player.z = next.z;

      if (player.x !== beforeX || player.z !== beforeZ) {
        this.scheduleDebouncedSave(sessionId);
      }
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

  override async onDrop(client: Client): Promise<void> {
    this.clearSaveTimer(client.sessionId);
    this.persistCharacter(client.sessionId);

    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = false;
    }

    try {
      await this.allowReconnection(client, 30);
    } catch {
      // reconnection window expired — onLeave handles cleanup
    }
  }

  override onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = true;
    }
  }

  override onLeave(client: Client): void {
    this.clearSaveTimer(client.sessionId);
    this.persistCharacter(client.sessionId);
    this.removePlayer(client.sessionId);
  }

  private removePlayer(sessionId: string): void {
    this.state.players.delete(sessionId);
    this.tickStates.delete(sessionId);
    this.pendingIntents.delete(sessionId);
    this.characterIds.delete(sessionId);
    this.characters.delete(sessionId);
    this.saveTimers.delete(sessionId);
  }

  private persistCharacter(sessionId: string): void {
    const characterId = this.characterIds.get(sessionId);
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!characterId || !player || !stored) return;

    saveCharacter(this.db, {
      ...stored,
      level: player.level,
      xp: player.xp,
      hp: player.hp,
      mp: player.mp,
      x: player.x,
      y: player.y,
      z: player.z,
    });
  }

  private scheduleDebouncedSave(sessionId: string): void {
    this.clearSaveTimer(sessionId);
    const timer = setTimeout(() => {
      this.persistCharacter(sessionId);
      this.saveTimers.delete(sessionId);
    }, this.saveDebounceMs);
    this.saveTimers.set(sessionId, timer);
  }

  private clearSaveTimer(sessionId: string): void {
    const timer = this.saveTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(sessionId);
    }
  }
}
