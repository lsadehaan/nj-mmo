import { Schema, type, ArraySchema } from '@colyseus/schema';

export class PartyState extends Schema {
  @type('number') id = 0;
  @type('string') leaderSessionId = '';
  @type(['string']) memberSessionIds = new ArraySchema<string>();
}
