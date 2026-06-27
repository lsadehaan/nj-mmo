import { Client, Room, Callbacks } from '@colyseus/sdk';
import { setConnected, setCharacterId, setOthers } from '../test-hook';
import type { GameRenderer } from '../scene/renderer';

const DEFAULT_ENDPOINT =
  import.meta.env.VITE_COLYSEUS_ENDPOINT ?? 'http://localhost:2567';

export const CHARACTER_ID_STORAGE_KEY = 'nj.characterId';

export function getStoredCharacterId(): string | null {
  return localStorage.getItem(CHARACTER_ID_STORAGE_KEY);
}

export function storeCharacterId(id: string): void {
  localStorage.setItem(CHARACTER_ID_STORAGE_KEY, id);
}

export async function connect(endpoint = DEFAULT_ENDPOINT): Promise<Room> {
  const client = new Client(endpoint);
  const characterId = getStoredCharacterId();
  if (characterId) {
    setCharacterId(characterId);
  }
  const options = characterId ? { characterId } : {};
  const room = await client.joinOrCreate('town', options);

  room.onMessage('characterId', (id: string) => {
    storeCharacterId(id);
    setCharacterId(id);
  });

  setConnected(true);
  return room;
}

export async function connectSafe(endpoint = DEFAULT_ENDPOINT): Promise<Room | null> {
  try {
    return await connect(endpoint);
  } catch {
    setConnected(false);
    return null;
  }
}

export function wireRoom(room: Room, game: GameRenderer): void {
  const callbacks = Callbacks.get(room);
  const localId = room.sessionId;

  const publishOthers = (): void => {
    setOthers(
      [...room.state.players.entries()]
        .filter(([sessionId]) => sessionId !== localId)
        .map(([sessionId, player]) => ({
          id: sessionId,
          x: (player as { x: number }).x,
          y: (player as { y: number }).y,
          z: (player as { z: number }).z,
        }))
    );
  };

  const syncLocal = (player: { x: number; y: number; z: number }): void => {
    game.syncLocalPlayer(player.x, player.y, player.z);
  };

  callbacks.onAdd('players', (player, sessionId) => {
    const id = sessionId as string;
    const state = player as { x: number; y: number; z: number };
    if (id === localId) {
      syncLocal(state);
      callbacks.onChange(state, () => syncLocal(state));
      return;
    }

    game.syncRemotePlayer(id, state.x, state.y, state.z);
    publishOthers();
    callbacks.onChange(state, () => {
      game.syncRemotePlayer(id, state.x, state.y, state.z);
      publishOthers();
    });
  });

  callbacks.onRemove('players', (_player, sessionId) => {
    const id = sessionId as string;
    if (id !== localId) {
      game.removeRemotePlayer(id);
      publishOthers();
    }
  });

  type MobSchema = { x: number; y: number; z: number; hp: number; maxHp: number };

  const syncMobFromState = (mobId: string, mob: MobSchema): void => {
    game.syncMob({
      id: mobId,
      x: mob.x,
      y: mob.y,
      z: mob.z,
      hp: mob.hp,
      maxHp: mob.maxHp,
    });
  };

  callbacks.onAdd('mobs', (mob, mobId) => {
    const id = mobId as string;
    const state = mob as MobSchema;
    syncMobFromState(id, state);
    callbacks.onChange(state, () => syncMobFromState(id, state));
  });

  callbacks.onRemove('mobs', (_mob, mobId) => {
    game.removeMob(mobId as string);
  });
}
