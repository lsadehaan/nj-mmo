import { Room, Client } from 'colyseus';
import { TownState, PlayerState } from './schema/TownState';

export class TownRoom extends Room<TownState> {
  override onCreate(): void {
    this.setState(new TownState());
    this.autoDispose = true;
  }

  override onJoin(client: Client): void {
    const player = new PlayerState();
    player.x = 0;
    player.y = 0;
    player.z = 0;
    this.state.players.set(client.sessionId, player);
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }
}
