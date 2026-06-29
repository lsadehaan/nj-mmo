# Phase 19 — Character Creation & Classes Design

## Overview

Phase 19 replaces the implicit “default Adventurer” join path with an explicit
**create-or-resume** character flow. Class identity flows from L2J XML → SQLite
master tables → server combat/vitals → replicated `PlayerState` → client manifest
→ rigged GLB avatar.

```
┌─────────────────────┐     create {classId,sex}     ┌──────────────────────┐
│ #character-creation │ ─────────────────────────────► │ TownRoom.onJoin      │
│ (client DOM)        │     characterId (resume)       │ createCharacter /    │
└─────────────────────┘                                │ loadCharacter        │
         │                                             └──────────┬───────────┘
         │ connectSafe + wireRoom                                │
         ▼                                                        ▼
┌─────────────────────┐     class_templates          ┌──────────────────────┐
│ player-manifest.ts  │ ◄── PlayerState.classId ──── │ getPlayerPAtk        │
│ player-avatar.ts    │                              │ applyClassLevelUp    │
└─────────────────────┘                              └──────────────────────┘
```

**Authority split (AD-001):** Class choice is validated and applied only on the
server during `onJoin`. Client creation UI is intent-only. Base stats affect combat
only through server-side `getPlayerPAtk` and vitals helpers — never client-computed.

---

## Architecture Decision: Class Base `pAtk` Formula

| Option | Pros | Cons | Decision |
| ------ | ---- | ---- | -------- |
| **A — `floor(basePAtk × strBonus + level)`** | Uses parsed L2J fields + `statBonus.xml`; testable; mystics weaker in melee | Not byte-identical to L2J Java `PAttackFinalizer` | **Selected** |
| B — Port full L2J stat engine | Maximum authenticity | Large scope; belongs in Phase 20 | Deferred |
| C — Keep `STARTER_COMBAT.pAtk=10` for all classes | No test churn | Violates ROADMAP “combat uses class stats” | Rejected |

**Rationale:** Delivers class-differentiated melee now with spec-anchored constants
from XML. Phase 20 can extend with INT/mAtk for magic skills.

---

## Architecture Decision: Level-Up Vitals

| Option | Pros | Cons | Decision |
| ------ | ---- | ---- | -------- |
| **A — Per-class L2J `lvlUpgainData` lookup** | Authentic HP/MP curves per class | Replaces `applyLevelUpReward` flat deltas | **Selected** |
| B — Keep +12/+5 universal | Simple | Wrong for Mystic (101 base HP) | Rejected |

**Implementation:** New `applyClassLevelUpReward` in `@nj/game-core` takes
`classId` + level curve rows; `TownRoom` passes character's `classId` on kill XP.

---

## Architecture Decision: Legacy Character Migration

| Option | Pros | Cons | Decision |
| ------ | ---- | ---- | -------- |
| **A — Default `classId=0`, preserve existing hp/maxHp** | No surprise stat change for in-flight saves | Old saves keep 100/50 until recreated | **Selected** |
| B — Recompute vitals on first load | Uniform data | Breaks active players mid-game | Rejected |

---

## Database Schema

### `class_templates`

| Column | Type | Source |
| ------ | ---- | ------ |
| `class_id` | INTEGER PK | `<classId>` |
| `name` | TEXT | `classList.xml` name |
| `race` | TEXT | derived enum: human/elf/dark_elf/orc/dwarf |
| `archetype` | TEXT | fighter \| mystic |
| `base_str` … `base_men` | INTEGER | `staticData/base*` |
| `base_p_atk` | REAL | `basePAtk` |
| `base_random_damage` | INTEGER | `baseRndDam` |
| `base_p_atk_spd` | INTEGER | `basePAtkSpd` |
| `base_crit_rate` | REAL | `baseCritRate` |

### `class_level_vitals`

| Column | Type | Source |
| ------ | ---- | ------ |
| `class_id` | INTEGER FK | template |
| `level` | INTEGER | `lvlUpgainData/@val` |
| `hp` | REAL | `<hp>` |
| `mp` | REAL | `<mp>` |

Seed levels **1–20** per class (TI level cap headroom).

### `characters` (migration)

```sql
ALTER TABLE characters ADD COLUMN class_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN sex INTEGER NOT NULL DEFAULT 0;
```

`Character` type + `saveCharacter`/`loadCharacter` extended.

---

## Seed Pipeline (AD-012)

**New fixtures** (`server/src/seed/__fixtures__/players/`):

- `StartingClass/HumanFighter.xml` … (9 files, trimmed from L2J)
- `statBonus_str_subset.xml` — STR rows needed for test anchors (values 22, 23, 40)
- `classList_snippet.xml` — id → name for nine starters

**New parser:** `server/src/seed/parsers/class-templates.parser.ts`

**New seeder:** `server/src/seed/seeders/class-templates.seeder.ts`

Wire into `server/src/seed/seed.ts` after `experience` seed.

**Seed tests:** `server/src/seed/class-templates.seed.spec.ts` — CHAR19-01–06.

---

## `@nj/game-core` Pure Module

**New files:**

```
libs/game-core/src/class/
  stat-bonus.ts          # lookupStrBonus(stat, value) — STR only MVP
  class-combat.ts        # calcClassBasePAtk, buildClassCombatScalars
  class-vitals.ts        # classVitalsAtLevel, applyClassLevelUpReward
  types.ts               # ClassTemplateSlice, ClassVitalsRow
```

**Exports** from `libs/game-core/src/index.ts`.

**`stat-bonus.ts`:** Parse committed fixture at build/test time OR embed STR table
as const map (preferred: small generated map from fixture in parser test, runtime
lookup from DB/cache on server). For **unit** purity, embed `STR_BONUS` map keyed
by stat value (40 → 1.2, 22 → 0.63, 23 → 0.66) — seeded from fixture in test.

**Deprecate** hard-coded use of `STARTER_COMBAT.pAtk` in combat path; keep
`STARTER_COMBAT.meleeRange` and `attackSpeed` until per-class speeds land in Phase 20.

**Update** `level-up-reward.ts`: either replace with `applyClassLevelUpReward` or
delegate when `classId` provided (avoid dual code paths long-term — migrate callers).

---

## Server: `TownRoom` Join Contract

### Join options (extended)

```typescript
type TownJoinOptions = {
  characterId?: string;
  create?: {
    classId: number;
    sex: 0 | 1;
  };
};
```

### `onJoin` logic

```
if (options.characterId) {
  character = loadCharacter(id) ?? createCharacter(db, { classId: 0, sex: 0 });
} else if (options.create && isValidStarterClassId(options.create.classId)) {
  character = createCharacter(db, options.create);
} else {
  throw ServerError or client.leave(); // CHAR19-21
}
syncPlayerFromCharacter(player, character, template);
replicateBaseStats(player, template);
```

### `createCharacter` (repository)

```typescript
export function createCharacter(
  db: AppDatabase,
  opts: { classId: number; sex: 0 | 1 }
): Character {
  const template = loadClassTemplate(db, opts.classId);
  const vitals = classVitalsAtLevel(opts.classId, 1, template);
  return {
    id: randomUUID(),
    name: STARTER_NAME,
    classId: opts.classId,
    sex: opts.sex,
    level: 1,
    xp: 0,
    hp: vitals.maxHp,
    mp: vitals.maxMp,
    maxHp: vitals.maxHp,
    maxMp: vitals.maxMp,
    // ... position, adena, etc.
  };
}
```

### `PlayerState` schema additions

```typescript
@type('number') classId = 0;
@type('number') sex = 0;
@type('number') str = 40;
@type('number') dex = 30;
@type('number') con = 43;
@type('number') int = 21;
@type('number') wit = 11;
@type('number') men = 25;
```

Defaults match Human Fighter; overwritten on join from template.

### Combat integration

```typescript
private getPlayerBasePAtk(player: PlayerState): number {
  const template = this.classTemplates.get(player.classId);
  return calcClassBasePAtk(template, player.level);
}

private getPlayerPAtk(player: PlayerState): number {
  const weaponId = player.equippedWeaponItemId || null;
  const weapon = weaponId ? this.itemsById.get(weaponId) : undefined;
  return effectivePAtk(
    this.getPlayerBasePAtk(player),
    weaponId,
    weapon?.pAtk ?? undefined
  );
}
```

Load `classTemplates` map in `onCreate` from DB.

---

## Client: Character Creation UI

**New module:** `client/src/ui/character-creation.ts`

- Mounts `#character-creation` on `document.body` (same DOM-overlay pattern as
  `#shop-window` / `#inventory-window`).
- State machine: `race` → `archetype` → `gender` → confirm.
- `resolveClassId(race, archetype)` → classId per spec table.
- Export `mountCharacterCreation(onCreate: (opts) => Promise<void>)`.

**`main.ts` boot change:**

```typescript
initGameState();
// ... mount HUD ...

if (!getStoredCharacterId()) {
  mountCharacterCreation(async (create) => {
    const room = await connectSafe(undefined, { create });
    if (room) { wireRoom(room, game); /* ... */ }
    setReady(true);
  });
  return; // defer connect until Create
}

// existing connect path for returning players
```

**`connect` / `connectSafe`:** accept optional `create` payload in join options.

---

## Client: Player Manifest

**New file:** `client/src/scene/creature/player-manifest.ts`

```typescript
export interface PlayerManifestEntry {
  classId: number;
  displayName: string;
  model: string;
  clipMap: Record<ClipName, string>; // KAYKIT_CLIP_MAP default
  scale: number;
  feetOffsetY: number;
}

export const PLAYER_MANIFEST: PlayerManifestEntry[] = [
  { classId: 0,  displayName: 'Human Fighter',  model: '/models/characters/Knight.glb',       scale: 1.0,  ... },
  { classId: 10, displayName: 'Human Mystic',   model: '/models/characters/Mage.glb',         scale: 1.0,  ... },
  { classId: 18, displayName: 'Elven Fighter',  model: '/models/characters/Rogue.glb',        scale: 1.0,  ... },
  { classId: 25, displayName: 'Elven Mystic',   model: '/models/characters/Mage.glb',         scale: 1.0,  ... },
  { classId: 31, displayName: 'Dark Fighter',   model: '/models/characters/Rogue_Hooded.glb', scale: 1.0,  ... },
  { classId: 38, displayName: 'Dark Mystic',    model: '/models/characters/Mage.glb',         scale: 1.0,  ... },
  { classId: 44, displayName: 'Orc Fighter',    model: '/models/characters/Barbarian.glb',    scale: 1.1,  ... },
  { classId: 49, displayName: 'Orc Mystic',     model: '/models/characters/Barbarian.glb',    scale: 1.05, ... },
  { classId: 53, displayName: 'Dwarf Fighter',  model: '/models/characters/Barbarian.glb',    scale: 0.85, ... },
];

export function getPlayerManifestEntry(classId: number): PlayerManifestEntry;
```

**`player-avatar.ts`:** Replace `DEFAULT_CHARACTER = 'Rogue'` with
`getPlayerManifestEntry(classId).model` via `createMeshCharacter(entry.model, { clipMap, scale })`.

**`remote-player-avatar.ts`:** Same; read `classId` from replicated state.

**`renderer.ts`:** Thread `classId` through `syncLocalPlayer` / remote sync.

**Gender:** Optional `scale` multiplier `sex === 1 ? 0.97 : 1.0` applied on top
of manifest scale (subtle; no separate GLB required).

---

## Client: `__GAME_STATE__` (AD-009)

Extend `GameStatePlayer`:

```typescript
export interface GameStatePlayer {
  // ... existing fields ...
  classId: number;
  sex: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wit: number;
  men: number;
  avatarModel: string;
}
```

`wireRoom` `setPlayer` maps schema fields + resolves `avatarModel` from manifest.

---

## Visual Gate (AD-017)

Per `game-designer` → `create-character.md`:

1. Extend `client/character-lab.html` to accept `?classId=N` query param.
2. Capture nine PNGs via `scripts/shoot-character.mjs --classId=N`.
3. Run `node scripts/visual-gate.mjs` — ensure manifest models exist, no dedup FAILs.
4. Human review screenshots (fidelity check) before Verifier PASS.

No new GLB downloads required if KayKit mapping passes fidelity review; document
in `client/public/models/characters/LICENSE.txt` if placeholders used.

---

## Test Impact & Regression

| Area | Change |
| ---- | ------ |
| Phase 7 melee anchors (17 dmg unarmed) | Update to **8** for default Human Fighter new chars |
| Phase 7 level 2 `maxHp=112` | Update Human Fighter room test to **91.83** |
| `character-repository` tests | New classId/sex cases |
| `TownRoom.spec.ts` | Join with `create`; use `create` for class-specific combat |
| `wire-room.spec.ts` | Add classId/stat sync cases |
| Consumable / shop tests | Use `create: { classId: 0 }` or explicit vitals where hp mattered |

**Room test helper:** `joinWithClass(room, { classId, sex })` wrapping client join options.

---

## File Touch List (expected)

| Area | Files |
| ---- | ----- |
| Seed | `__fixtures__/players/**`, `parsers/class-templates.parser.ts`, `seeders/class-templates.seeder.ts`, `seed.ts` |
| game-core | `class/*.ts`, `index.ts`, update combat tests |
| server DB | `schema.ts`, `client.ts` migrations, `character-repository.ts` |
| server room | `TownRoom.ts`, `TownState.ts`, `combat-resolver` callers |
| client UI | `character-creation.ts`, `character-creation.spec.ts`, `main.ts`, `index.html` styles |
| client scene | `player-manifest.ts`, `player-avatar.ts`, `remote-player-avatar.ts`, `renderer.ts` |
| client net | `room.ts`, `wire-room.spec.ts`, `test-hook.ts` |
| tooling | `character-lab.ts`, `shoot-character.mjs`, `visual-gate.mjs` (if needed) |

---

## Security & Validation

- **Allowed classIds:** whitelist `{0,10,18,25,31,38,44,49,53}` on server.
- **sex:** must be `0` or `1`.
- **create + characterId:** if both sent, **ignore create** (resume wins).
- No rate limit (local MVP).

---

## Deferred to Phase 20

- INT/WIT/MEN affecting magic skill damage and max MP growth formulas beyond L2J table
- Per-class `basePAtkSpd` / `baseCritRate` in combat resolver
- Mystic-specific cast animations beyond shared Mage GLB
