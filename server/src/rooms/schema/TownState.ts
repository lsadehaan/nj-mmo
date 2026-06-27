import { Schema, type, MapSchema } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') hp = 100;
  @type('number') mp = 50;
  @type('number') xp = 0;
  @type('number') level = 1;
  @type('boolean') connected = true;
}

export class TownState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
