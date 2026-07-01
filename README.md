# 🏰 NJ MMO — A Talking Island Browser MMORPG

> A fully playable, low-poly 3D MMORPG that runs entirely in your browser —
> an authoritative [Colyseus](https://colyseus.io/) server + a
> [Three.js](https://threejs.org/) client, inspired by L2 Classic's Talking Island.
> Every gameplay outcome is decided by the server; the client only renders and sends intent.

## 🧱 Built with

- 🎮 **[Colyseus](https://colyseus.io/)** — authoritative multiplayer game server
- 🌐 **[Three.js](https://threejs.org/)** — real-time 3D rendering in the browser
- 📦 **[Nx](https://nx.dev/)** monorepo — `server/` + `client/` + shared `libs/game-core` rules
- 🗄️ **SQLite + [Drizzle ORM](https://orm.drizzle.team/)** — persistence, seeded from L2J Classic data
- ⚡ **[Vite](https://vitejs.dev/)** — client dev server & build
- 🧪 **[Vitest](https://vitest.dev/) + `@colyseus/testing`** — unit + room-integration test gate
- 🟦 **TypeScript** end to end (Node 22+)

## 🤖 An AI experiment

**This entire project — every line of game logic, every spec, every test, every 3D
asset pipeline decision — was built by AI agents**, not hand-written. It's a
real-world stress test of autonomous, spec-driven software development on a
non-trivial project (an authoritative multiplayer game server).

The build followed a **Planner → Implementer → Verifier** loop, one ROADMAP phase
at a time, with an independent Verifier (never the same agent that implemented the
feature) re-checking every phase against its spec before it could be marked done.
If you want to see how it was done or run the same process yourself:

- [`.cursor/skills/spec-driven-execution/SKILL.md`](.cursor/skills/spec-driven-execution/SKILL.md)
  — the orchestrator: how the Planner/Implementer/Verifier sub-agents are
  dispatched, and the autonomous `/loop` that walks the roadmap.
- [`.cursor/skills/game-designer/SKILL.md`](.cursor/skills/game-designer/SKILL.md)
  — how every 3D character, monster, prop, icon, and VFX asset was sourced/built
  and passed a mandatory visual gate.
- [`.specs/ROADMAP.md`](.specs/ROADMAP.md) — the full 29-phase build plan, with
  scope, dependencies, and out-of-scope calls for every phase.
- [`.specs/STATE.md`](.specs/STATE.md) — the running decision log (`AD-NNN`
  architecture decisions) and per-phase verification handoffs.
- [`.specs/features/`](.specs/features/) — one `spec.md` / `design.md` / `tasks.md`
  / `validation.md` set per phase, produced and verified by the agents themselves.
- [`AGENTS.md`](AGENTS.md) — the testing contract every agent-written change has
  to satisfy (server authority, three test layers, deterministic seeded RNG).

## ✨ What's actually playable

This isn't a tech demo — all 29 roadmap phases are complete and independently verified.
Here's what you can do right now:

- 🗺️ **A full open world** — 640 m of explorable Talking Island (village, fields, Elven
  Ruins, Obelisk, Harbor, Cave of Souls/Maze) across 6 named zones, with terrain-aware
  movement, collision, and A\* pathfinding around buildings.
- 🧝 **9 playable races & classes** — Human/Elf/Dark Elf/Orc/Dwarf Fighter & Mystic
  paths, each with distinct stats, HP/MP curves, and a rigged 3D avatar.
- ⚔️ **Real combat & skills** — server-validated melee and magic, MP costs and cooldowns,
  soulshots/spiritshots, a cast bar with interrupt-on-hit, and buffs/debuffs.
- 🐺 **A full bestiary** — 23+ authentic Talking Island monsters, each a rigged 3D
  creature with idle/move/attack/die animations, ranged AI, and pack behavior.
- 🏘️ **A living town** — 25 NPCs: weapon/armor/accessory merchants, a Warehouse Keeper
  with real item storage, folk trainers, a High Priest who buffs and resurrects, guards,
  Gatekeeper teleports, and first-class transfer at the Grand Master.
- 📜 **17 quests**, including the full Tutorial chain, with kill/collect/talk objectives
  and server-validated rewards and a quest log UI.
- 🎒 **Items & economy** — ~87 items across 11 equipment slots (paper-doll), dwarven
  crafting/recipes, safe +1..+3 enchanting, and set bonuses.
- 🤝 **Social systems** — chat channels (all/local/trade/party), party with shared XP &
  loot, player trade window, and a friend list.
- 💀 **Progression & PvP** — death XP loss/restore via High Priest, PvP flag + karma,
  delevel, and stat re-specialization at trainers.
- 🖥️ **A real client shell** — login screen, character select, inventory grid, skill
  window, quest log, party UI, minimap/world map, buff/debuff bars, and a
  target-of-target frame.
- 🎧 **Audio** — zone-appropriate music loops, combat/cast/UI SFX, and ambient world audio.

## 🔒 Server-authoritative by design

Every gameplay outcome — movement, damage, XP, drops, trades, skills — is decided and
validated on the server; the client is never trusted. See [AGENTS.md](AGENTS.md) for the
full testing contract.

## 🧪 Tested like it matters

A fast, deterministic test suite covers three layers — unit (server + client),
Colyseus room-integration, and seed/data — with all randomness driven by an injected
seeded RNG and no wall-clock sleeps. See [AGENTS.md](AGENTS.md) and
[`.specs/ROADMAP.md`](.specs/ROADMAP.md) for the full phase-by-phase build history.

---

## Prerequisites

- Node.js 22+ (machine tested on v24)
- npm

## First-time setup

```bash
npm install                     # install dependencies
npx nx build game-core          # build shared lib (server resolves @nj/game-core from dist at runtime)
npx tsx server/src/seed/cli.ts  # seed data/game.db (mobs, NPCs, skills, items, spawns)
```

## Start the game

From the repo root:

```bash
npm run dev
```

This starts both processes concurrently:

- **server** (Colyseus) → `http://localhost:2567`
- **client** (Vite) → `http://localhost:4200`

Then open **http://localhost:4200** in your browser. The client auto-connects to
the local server and creates/loads your character (identified by a `characterId`
persisted in `localStorage`). Open a second browser or incognito window to see
real-time multiplayer.

## Controls

| Input | Action |
| --- | --- |
| **Click ground** | Move there (server-validated) |
| **Click a monster** | Target it |
| **Space** or **`1`** | Basic melee attack on target |
| **`2`** | Power Strike (MP cost + cooldown) |
| **`E`** (near an NPC) | Interact — opens the merchant shop or NPC dialog |
| **`I`** | Toggle inventory (equip a weapon) |

## Quick start loop

1. Create your character, pick a race/class at the selection screen.
2. Walk to **Roxxy** (helper NPC), press **`E`**, and claim the **starter kit**
   (3× Healing Potion + Squire's Sword).
3. Press **`I`** and **Equip** the Squire's Sword (melee damage 17 → 27).
4. Head to the field, click a **monster**, and attack (**Space**) or cast
   **Power Strike** (**`2`**) to kill it and gain XP. Two kills reaches **level 2**
   (+max HP/MP).
5. If a mob kills you, you **respawn in town** at full HP (no XP lost at low level).
6. Back in town, press **`E`** at **Katerina** (merchant) to **buy** a Healing
   Potion (adena is deducted).
7. Combat is **disabled inside the town peace zone** (enforced server-side).

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `NJ_DB_PATH` | `data/game.db` | SQLite database path (server + seed) |
| `VITE_COLYSEUS_ENDPOINT` | `http://localhost:2567` | Client → server endpoint (build-time) |

## Tests

```bash
nx test game-core        # shared rules (formulas, RNG, XP, drops) — unit
nx test server           # server rules + room integration (@colyseus/testing)
nx test client           # client unit (state/DOM/hook mapping)
nx run-many -t build lint test   # full gate
```

Tests assert server-defined outcomes; randomness runs through an injected seeded
RNG. Client tests use `__GAME_STATE__` and DOM assertions. See `AGENTS.md` for
the testing contract and `.specs/ROADMAP.md` for the phased build.
