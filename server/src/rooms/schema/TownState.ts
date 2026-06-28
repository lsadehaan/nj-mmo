import { Schema, type, MapSchema } from '@colyseus/schema';
import { MobState } from './MobState';
import { NpcState } from './NpcState';
import { ItemStackState } from './ItemStackState';

export class PlayerState extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') hp = 100;
  @type('number') mp = 50;
  @type('number') maxHp = 100;
  @type('number') maxMp = 50;
  @type('number') equippedWeaponItemId = 0;
  @type('number') xp = 0;
  @type('number') level = 1;
  @type('number') adena = 1000;
  @type('boolean') connected = true;
  @type('number') powerStrikeCooldownEndMs = 0;
  /** Render-only; not persisted (AD-015). */
  @type('number') action = 0;
  /** Render-only; not persisted (AD-015). */
  @type('number') actionSeq = 0;
  @type({ map: ItemStackState }) items = new MapSchema<ItemStackState>();
}

export class TownState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: MobState }) mobs = new MapSchema<MobState>();
  @type({ map: NpcState }) npcs = new MapSchema<NpcState>();
}
