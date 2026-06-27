import { Schema, type, MapSchema } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
}

export class TownState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
