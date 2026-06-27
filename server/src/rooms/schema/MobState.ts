import { Schema, type } from '@colyseus/schema';

export class MobState extends Schema {
  @type('string') id = '';
  @type('number') npcId = 0;
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') hp = 0;
  @type('number') maxHp = 0;
}
