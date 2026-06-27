import { Client, Room } from '@colyseus/sdk';
import { setConnected } from '../test-hook';

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
  const options = characterId ? { characterId } : {};
  const room = await client.joinOrCreate('town', options);

  room.onMessage('characterId', (id: string) => {
    storeCharacterId(id);
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
