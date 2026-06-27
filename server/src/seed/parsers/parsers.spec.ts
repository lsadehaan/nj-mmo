import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseMonsters } from './monsters.parser';
import { parseNpcs } from './npcs.parser';
import { parsePowerStrike } from './skills.parser';
import { parseExperience } from './experience.parser';

const fixtures = join(__dirname, '../__fixtures__');

describe('parseMonsters', () => {
  const xml = readFileSync(join(fixtures, 'monsters.xml'), 'utf-8');

  it('parses Gremlin with authentic Classic values', () => {
    const mobs = parseMonsters(xml, [20001]);
    expect(mobs[0]).toEqual({
      npcId: 20001,
      name: 'Gremlin',
      level: 1,
      type: 'Monster',
      race: 'FAIRY',
      exp: 44,
      sp: 0,
      hp: 41.145,
      mp: 44.247,
      pAtk: 8.47458,
      pDef: 44.44444,
      attackSpeed: 253,
      random: 30,
      critical: 4.75,
      accuracy: 4.75,
      attackRange: 40,
      aggroRange: 0,
      isAggressive: false,
      respawnSec: 27,
    });
  });

  it('parses Goblin aggro flags from fixture XML', () => {
    const mobs = parseMonsters(xml, [20003]);
    expect(mobs[0]).toMatchObject({ isAggressive: true, aggroRange: 450 });
  });

  it('parses Wolf as aggressive with aggroRange 450', () => {
    const mobs = parseMonsters(xml, [20120]);
    expect(mobs[0]).toMatchObject({ isAggressive: true, aggroRange: 450 });
  });

  it('parses Keltir as passive despite aggroRange attribute', () => {
    const mobs = parseMonsters(xml, [20481]);
    expect(mobs[0]).toMatchObject({ isAggressive: false, aggroRange: 500 });
  });

  it('parses Goblin combat stats from fixture XML', () => {
    const mobs = parseMonsters(xml, [20003]);
    expect(mobs[0]).toMatchObject({
      pAtk: 12.34006,
      pDef: 51.60553,
      attackSpeed: 253,
      attackRange: 40,
    });
  });

  it('throws naming entity id when acquire.exp is missing', () => {
    const bad = xml.replace('exp="44"', '');
    expect(() => parseMonsters(bad, [20001])).toThrow(
      'Missing required field "acquire.exp" for entity id 20001'
    );
  });
});

describe('parseNpcs', () => {
  const xml = readFileSync(join(fixtures, 'npcs.xml'), 'utf-8');

  it('parses Katerina with authentic Classic values', () => {
    const npcs = parseNpcs(xml, [30004]);
    expect(npcs[0]).toEqual({
      npcId: 30004,
      name: 'Katerina',
      title: 'Grocer',
      type: 'Merchant',
      level: 70,
    });
  });

  it('throws naming entity id when title is missing', () => {
    const bad = xml.replace('title="Grocer"', '');
    expect(() => parseNpcs(bad, [30004])).toThrow(
      'Missing required field "title" for entity id 30004'
    );
  });
});

describe('parsePowerStrike', () => {
  const xml = readFileSync(join(fixtures, 'skills.xml'), 'utf-8');

  it('parses Power Strike with authentic Classic values', () => {
    expect(parsePowerStrike(xml)).toEqual({
      skillId: 3,
      name: 'Power Strike',
      maxLevel: 9,
      operateType: 'A1',
      targetType: 'ENEMY',
      castRange: 40,
      reuseDelay: 3000,
      mpConsumeL1: 9,
    });
  });

  it('throws naming entity id when reuseDelay is missing', () => {
    const bad = xml.replace('<reuseDelay>3000</reuseDelay>', '');
    expect(() => parsePowerStrike(bad)).toThrow(
      'Missing required field "reuseDelay" for entity id 3'
    );
  });
});

describe('parseExperience', () => {
  const xml = readFileSync(join(fixtures, 'experience.xml'), 'utf-8');

  it('parses spot XP values from the Classic curve', () => {
    const rows = parseExperience(xml);
    expect(rows.find((r) => r.level === 2)?.xpToNextLevel).toBe(68);
    expect(rows.find((r) => r.level === 3)?.xpToNextLevel).toBe(364);
    expect(rows.find((r) => r.level === 10)?.xpToNextLevel).toBe(48230);
  });

  it('throws when tolevel attribute is missing', () => {
    const bad = xml.replace('tolevel="68"', '');
    expect(() => parseExperience(bad)).toThrow(
      'Missing required field "tolevel" for entity id 2'
    );
  });
});
