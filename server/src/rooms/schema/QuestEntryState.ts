import { Schema, type, ArraySchema } from '@colyseus/schema';

export class QuestEntryState extends Schema {
  @type('number') questId = 0;
  @type('string') status = 'in_progress';
  @type('number') step = 0;
  @type(['number']) counters = new ArraySchema<number>();
}
