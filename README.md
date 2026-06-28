# NJ — Browser MMO (Talking Island vertical slice)

A browser-playable, low-poly 3D multiplayer MVP inspired by Lineage 2 — a Talking
Island vertical slice. Authoritative [Colyseus](https://colyseus.io/) server +
[Three.js](https://threejs.org/) client in an [Nx](https://nx.dev/) monorepo
(`server/` + `client/`), SQLite + Drizzle, seeded from L2J_Mobius Classic data.

The server is authoritative: all gameplay outcomes (movement, combat, XP, drops,
skills, shop, peace zone) are decided and validated server-side; the client only
renders state and sends intent.

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

## The MVP loop

1. Walk to **Roxxy** (helper NPC), press **`E`**, and claim the **starter kit**
   (3× Healing Potion + Squire's Sword).
2. Press **`I`** and **Equip** the Squire's Sword (melee damage 17 → 27).
3. Head to the field, click a **monster**, and attack (**Space**) or cast
   **Power Strike** (**`2`**) to kill it and gain XP. Two kills reaches **level 2**
   (+max HP/MP).
4. If a mob kills you, you **respawn in town** at full HP (no XP lost at low level).
5. Back in town, press **`E`** at **Katerina** (merchant) to **buy** a Healing
   Potion (adena is deducted).
6. Combat is **disabled inside the town peace zone** (enforced server-side).

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
nx e2e client-e2e        # Playwright: DOM HUD + multiplayer + full loop
nx run-many -t build lint test   # full gate
```

Tests assert server-defined outcomes; randomness runs through an injected seeded
RNG; WebGL is not pixel-tested — logical state is asserted via the
`window.__GAME_STATE__` hook. See `AGENTS.md` for the testing contract and
`.specs/ROADMAP.md` for the phased build.

> Public production deployment is deferred post-MVP; the slice runs locally via
> `npm run dev`.
