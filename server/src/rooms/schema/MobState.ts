import { Schema, type } from '@colyseus/schema';

export class MobState extends Schema {
  @type('string') id = '';
  @type('number') npcId = 0;
  /** Static display name from the monster template (set once at spawn). */
  @type('string') name = '';
  /** Monster level for the target frame (set once at spawn). */
  @type('number') level = 0;
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') hp = 0;
  @type('number') maxHp = 0;
  /** Render-only; not persisted (AD-015). */
  @type('number') action = 0;
  /** Render-only; not persisted (AD-015). */
  @type('number') actionSeq = 0;
  @type('string') aggroTargetSessionId = '';
}
