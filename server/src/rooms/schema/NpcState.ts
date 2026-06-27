import { Schema, type } from '@colyseus/schema';

export class NpcState extends Schema {
  @type('string') id = '';
  @type('number') npcId = 0;
  @type('string') name = '';
  @type('string') title = '';
  @type('string') type = '';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
}
