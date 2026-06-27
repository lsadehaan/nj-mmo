import { Schema, type, MapSchema } from '@colyseus/schema';
import { MobState } from './MobState';

export class PlayerState extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') hp = 100;
  @type('number') mp = 50;
  @type('number') xp = 0;
  @type('number') level = 1;
  @type('boolean') connected = true;
  @type('number') powerStrikeCooldownEndMs = 0;
}

export class TownState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: MobState }) mobs = new MapSchema<MobState>();
}
