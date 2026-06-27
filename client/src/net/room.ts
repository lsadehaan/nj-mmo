import { Client, Room } from '@colyseus/sdk';
import { setConnected } from '../test-hook';

const DEFAULT_ENDPOINT =
  import.meta.env.VITE_COLYSEUS_ENDPOINT ?? 'http://localhost:2567';

export async function connect(endpoint = DEFAULT_ENDPOINT): Promise<Room> {
  const client = new Client(endpoint);
  const room = await client.joinOrCreate('town');
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
