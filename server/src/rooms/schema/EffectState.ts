import { Schema, type } from '@colyseus/schema';

export class EffectState extends Schema {
  @type('number') skillId = 0;
  @type('string') kind = '';
  @type('number') expiresAtMs = 0;
}
