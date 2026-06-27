import { Schema, type } from '@colyseus/schema';

export class ItemStackState extends Schema {
  @type('number') itemId = 0;
  @type('number') count = 0;
}
