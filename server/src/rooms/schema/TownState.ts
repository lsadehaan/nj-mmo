import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import { MobState } from './MobState';
import { NpcState } from './NpcState';
import { ItemStackState } from './ItemStackState';
import { QuestEntryState } from './QuestEntryState';
import { PartyState } from './PartyState';
import { EffectState } from './EffectState';

export class PlayerState extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') classId = 0;
  @type('number') sex = 0;
  @type('number') str = 40;
  @type('number') dex = 30;
  @type('number') con = 43;
  @type('number') int = 21;
  @type('number') wit = 11;
  @type('number') men = 25;
  @type('number') hp = 100;
  @type('number') mp = 50;
  @type('number') maxHp = 100;
  @type('number') maxMp = 50;
  @type('number') equippedWeaponItemId = 0;
  @type(['number']) equipSlotIds = new ArraySchema<number>();
  @type(['number']) equipItemIds = new ArraySchema<number>();
  @type(['number']) equipEnchantLevels = new ArraySchema<number>();
  @type('number') pDef = 0;
  @type('number') xp = 0;
  @type('number') level = 1;
  @type('number') adena = 1000;
  @type('boolean') connected = true;
  @type('string') zoneId = 'ti_village';
  @type(['number']) knownSkillIds = new ArraySchema<number>();
  @type(['number']) skillCooldownEndMs = new ArraySchema<number>();
  @type('number') castingSkillId = 0;
  @type('number') castEndMs = 0;
  /** Active self-buff skill id (0 = none) — render hook for client effects list */
  @type('number') activeBuffSkillId = 0;
  @type([EffectState]) activeEffects = new ArraySchema<EffectState>();
  /** @deprecated alias for skill 3 cooldown — synced from skillCooldownEndMs */
  @type('number') powerStrikeCooldownEndMs = 0;
  @type('number') healingPotionCooldownEndMs = 0;
  /** Render-only; not persisted (AD-015). */
  @type('number') action = 0;
  /** Render-only; not persisted (AD-015). */
  @type('number') actionSeq = 0;
  @type({ map: ItemStackState }) items = new MapSchema<ItemStackState>();
  @type([QuestEntryState]) questEntries = new ArraySchema<QuestEntryState>();
  @type(['number']) warehouseItemIds = new ArraySchema<number>();
  @type(['number']) warehouseItemCounts = new ArraySchema<number>();
  @type('number') partyId = 0;
  @type('string') characterName = '';
  @type('number') sp = 0;
  @type('number') karma = 0;
  @type('number') pvpFlag = 0;
  @type('number') pvpFlagEndMs = 0;
  @type('number') expBeforeDeath = 0;
  @type('number') unspentStatPoints = 0;
  @type('number') bonusStr = 0;
  @type('number') bonusDex = 0;
  @type('number') bonusCon = 0;
  @type('number') bonusInt = 0;
  @type('number') bonusWit = 0;
  @type('number') bonusMen = 0;
  @type('number') inventoryWeight = 0;
  @type('number') maxLoad = 0;
  @type('number') inventorySlotsUsed = 0;
}

export class TownState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: MobState }) mobs = new MapSchema<MobState>();
  @type({ map: NpcState }) npcs = new MapSchema<NpcState>();
  @type({ map: PartyState }) parties = new MapSchema<PartyState>();
}
