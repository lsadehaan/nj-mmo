import { Client, Room, Callbacks } from '@colyseus/sdk';
import { setConnected, setCharacterId, setOthers, setMobs, setPlayer } from '../test-hook';
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
        .filter(
          ([sessionId, player]) =>
            sessionId !== localId && (player as { connected?: boolean }).connected !== false
        )
        .map(([sessionId, player]) => ({
          id: sessionId,
          x: (player as { x: number }).x,
          y: (player as { y: number }).y,
          z: (player as { z: number }).z,
        }))
    );
  };

  type PlayerSchema = {
    x: number;
    y: number;
    z: number;
    xp: number;
    level: number;
    mp: number;
    powerStrikeCooldownEndMs: number;
  };

  type MobSchema = {
    npcId: number;
    x: number;
    y: number;
    z: number;
    hp: number;
    maxHp: number;
  };

  const publishMobs = (): void => {
    const mobsMap = room.state.mobs;
    if (!mobsMap) {
      setMobs([]);
      return;
    }
    setMobs(
      [...mobsMap.entries()].map(([id, mob]) => {
        const state = mob as MobSchema;
        return {
          id,
          npcId: state.npcId,
          x: state.x,
          y: state.y,
          z: state.z,
          hp: state.hp,
          maxHp: state.maxHp,
        };
      })
    );
  };

  let prevPowerStrikeCooldownEndMs = 0;

  const syncLocal = (player: PlayerSchema): void => {
    if (prevPowerStrikeCooldownEndMs === 0 && player.powerStrikeCooldownEndMs > 0) {
      game.triggerSkillFlash();
    }
    prevPowerStrikeCooldownEndMs = player.powerStrikeCooldownEndMs;

    game.syncLocalPlayer(player.x, player.y, player.z);
    setPlayer({
      x: player.x,
      y: player.y,
      z: player.z,
      xp: player.xp,
      level: player.level,
      mp: player.mp,
      powerStrikeCooldownEndMs: player.powerStrikeCooldownEndMs,
      powerStrikeCooldownRemainingMs: 0,
    });
  };

  callbacks.onAdd('players', (player, sessionId) => {
    const id = sessionId as string;
    const state = player as PlayerSchema;
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

  const syncMobFromState = (mobId: string, mob: MobSchema): void => {
    game.syncMob({
      id: mobId,
      x: mob.x,
      y: mob.y,
      z: mob.z,
      hp: mob.hp,
      maxHp: mob.maxHp,
    });
    publishMobs();
  };

  callbacks.onAdd('mobs', (mob, mobId) => {
    const id = mobId as string;
    const state = mob as MobSchema;
    syncMobFromState(id, state);
    callbacks.onChange(state, () => syncMobFromState(id, state));
  });

  callbacks.onRemove('mobs', (_mob, mobId) => {
    game.removeMob(mobId as string);
    publishMobs();
  });

  if (room.state.mobs) {
    for (const [id, mob] of room.state.mobs.entries() as Iterable<[string, MobSchema]>) {
      syncMobFromState(id, mob);
      callbacks.onChange(mob, () => syncMobFromState(id, mob));
    }
  }

  publishMobs();
}
