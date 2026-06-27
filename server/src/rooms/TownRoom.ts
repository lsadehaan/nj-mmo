import { Room, Client } from 'colyseus';
import { TownState, PlayerState } from './schema/TownState';

export class TownRoom extends Room {
  declare state: TownState;

  override onCreate(): void {
    this.setState(new TownState());
    this.autoDispose = true;
  }

  override onJoin(client: Client): void {
    const player = new PlayerState();
    player.x = 0;
    player.y = 0;
    player.z = 0;
    player.hp = 100;
    player.mp = 50;
    player.xp = 0;
    player.level = 1;
    player.connected = true;
    this.state.players.set(client.sessionId, player);
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }
}
