# Important Technical Decisions (ITD) — nj-mmo

> An independent register of the most consequential architecture decisions in this
> project, each with the decision as actually implemented, two credible
> alternatives, and an honest evaluation of the trade-offs. Compiled 2026-08-08
> from a code + live-runtime audit of the repository at commit `7bba727`.
>
> This complements the agent-authored `.specs/STATE.md` "AD-NNN" log. Where an AD
> exists, it is cross-referenced. Verdicts here are the reviewer's, not the
> original authors'.

---

## ITD-1 — Server-authoritative simulation with intent-only messaging

**Cross-ref:** AD-001, AD-008, AD-018

**Decision made.** The Colyseus server owns all gameplay state. Clients send
*intent* messages only (`move {targetX,targetZ}`, `attack`, `useSkill`, …); they
never send positions or outcomes. The server validates each intent, runs A\*
pathfinding on a walkability grid, integrates movement at a server-fixed speed in
a 50 ms simulation tick, and resolves combat (range, cooldown, MP, peace-zone)
server-side. Verified live: a client move to (99999, 99999) was rejected and the
avatar did not move; combat damage and XP were entirely server-decided.

**Alternative A — Client-authoritative with server reconciliation.** Clients
simulate locally and send resulting state; server spot-checks and corrects.
- *Pros:* Zero input latency, far less server CPU, trivial to build.
- *Cons:* Every value is a cheat vector; reconciliation is harder to get right
  than pure authority; wrong model for a persistent shared-economy MMO.

**Alternative B — Deterministic lockstep.** All clients run the identical
simulation from a shared seed and exchange only inputs.
- *Pros:* Tiny bandwidth; naturally cheat-resistant to state edits.
- *Cons:* Requires bit-perfect determinism across browsers (very hard in JS/
  floating point); one desync corrupts everyone; poor fit for large, churning
  player counts joining/leaving continuously.

**Honest evaluation.** This is the correct decision and the best-executed part of
the project. The intent-only boundary is real and consistently enforced — there
is no message anywhere that accepts a client position. The one caveat is that
"authority" was implemented as *design* without the *validation layer* it depends
on (see ITD-6 and the main report): the model is right, the numeric input
hardening is missing. **Verdict: right call, partially delivered.**

---

## ITD-2 — Single monolithic room, single zone, single process

**Cross-ref:** AD-006, AD-013; `server/src/app.config.ts:11`, `TownRoom.ts` (2,629 lines)

**Decision made.** One Colyseus room type (`town`) holds the entire world; the six
"zones" are regions inside that one room's single map. All game systems live in or
hang off `TownRoom`, which coordinates ~36 parallel `Map`s keyed by `sessionId`.
Multiple room *instances* are possible via `.filterBy(['instanceKey'])`, but each
is a full independent copy of the whole world.

**Alternative A — One room per zone, with server-side handoff.** Each named zone is
its own room; crossing a boundary transfers the player between rooms.
- *Pros:* Natural CPU/state partition; a busy zone can't starve a quiet one; maps
  cleanly onto how MMOs actually scale; smaller, testable room classes.
- *Cons:* Cross-zone concerns (party, trade, chat, friends) need an inter-room
  layer (presence service / message bus); handoff is fiddly.

**Alternative B — Interest-managed shards / spatial partitioning.** One logical
world split into a grid of simulation cells across processes, with per-client
interest (area-of-interest) replication.
- *Pros:* Highest ceiling; only replicates what a client can see; the real
  large-scale MMO answer.
- *Cons:* Large complexity investment; overkill for a vertical slice; needs a
  distributed state story from day one.

**Honest evaluation.** Single-room was the pragmatic MVP choice and fine for a
demo, but it has calcified into a scaling ceiling and a maintainability problem.
`TownRoom` is a 2,629-line god object; the whole world simulates on one event
loop; and the current pathfinder (ITD-3 concern) makes the tick budget break
around ~20 concurrent players. `.filterBy(['instanceKey'])` with no `maxClients`
and no DB-connection caching also opens an unbounded-room-creation DoS and a
same-character-in-two-rooms dupe. **Verdict: acceptable for a prototype, but the
single biggest structural debt for anything beyond a demo.**

---

## ITD-3 — Pathfinding as a per-call A\* over a full grid

**Cross-ref:** AD-018; `libs/game-core/src/pathfinding.ts`, `walkability-grid.ts`

**Decision made.** A genuine octile-heuristic A\* runs over a ~630×630 walkability
grid (slope + water + building/prop AABBs), called on every move intent, with the
server following the returned waypoints authoritatively. The open set is a
`Set<number>` scanned linearly for the min f-score, and each call allocates three
full-grid typed arrays (~7.9 MB) that are then `.fill()`-ed.

**Alternative A — Binary-heap A\* with reusable scratch buffers.** Same algorithm,
but a priority queue for the open set and persistent pre-allocated arrays reset via
a generation counter.
- *Pros:* Drops per-pop cost from O(V) to O(log V); eliminates ~7.9 MB of garbage
  per pathfind; likely 10–50× faster with a one-file change.
- *Cons:* Slightly more code; must manage buffer lifecycle.

**Alternative B — Flow-field / navmesh pathing.** Precompute a navmesh (or, for
common destinations, flow fields) instead of grid A\* per request.
- *Pros:* Near-constant-time queries; smoother paths; standard for production.
- *Cons:* Navmesh generation tooling; larger conceptual leap; harder to keep
  deterministic for the seeded-test contract.

**Honest evaluation.** The decision to have *real* server-side pathfinding was
right and rare for a 5-day build. The *implementation* is textbook-naive and is
the server's number-one CPU risk: O(V²) behavior on a ~397k-cell grid plus
multi-megabyte allocation churn per call, atop a 515 ms first-build stall.
Alternative A is almost free and should have been the baseline. **Verdict: right
feature, wrong data structures — cheap to fix, expensive to leave.**

---

## ITD-4 — SQLite + Drizzle, debounced non-transactional persistence

**Cross-ref:** AD-007, AD-011; `server/src/db/`, `TownRoom.ts` save path

**Decision made.** Persistence is better-sqlite3 + Drizzle ORM ("SQLite now,
Postgres-ready"), written on a 5-second debounce and on disconnect. Character
saves are performed as four independent, *non-transactional*, delete-then-insert
sequences (items, equipment, skills each `DELETE *` then re-`INSERT`). `db.transaction`
is used only in the seeder. A hand-rolled `CREATE TABLE IF NOT EXISTS` +
`ALTER TABLE` migration system in `db/client.ts` duplicates several table
definitions and runs in parallel to the (unused) drizzle-kit config.

**Alternative A — Same SQLite/Drizzle, but transactional write-behind.** Wrap each
character save (and each trade's two-sided swap) in a single `db.transaction`, and
use Drizzle migrations as the one source of schema truth.
- *Pros:* Eliminates the delete-then-insert data-loss window; makes trades atomic;
  ends schema drift. Small, localized change.
- *Cons:* Marginally more care around transaction scope; essentially no downside.

**Alternative B — Postgres from the start (or Redis write-behind + durable store).**
A networked DB, or an in-memory hot store flushed to a durable DB.
- *Pros:* Real concurrency, connection pooling, and horizontal-scale readiness;
  Redis path removes DB work from the tick entirely.
- *Cons:* Heavier ops for an MVP; premature until the room/zone story (ITD-2) is
  settled; SQLite is genuinely fine for a single-process slice.

**Honest evaluation.** SQLite-first was a sensible MVP call and the Drizzle schema
is clean. The *save mechanism* is the problem, and it is serious: delete-then-
insert with no transaction is the textbook data-loss pattern — a crash or thrown
exception between the DELETE and INSERT permanently erases a player's inventory,
and trades persist the two sides non-atomically. That risk is amplified by the
missing input validation elsewhere (a bad value can *cause* the mid-save throw).
Warehouse and quest state are saved through entirely separate mechanisms, so the
persistence story is inconsistent across four code paths. **Verdict: right engine,
unsafe write path — Alternative A is mandatory before any real use.**

---

## ITD-5 — Identity by bearer `characterId`, no authentication

**Cross-ref:** `server/src/app.config.ts` (no `onAuth`), `db/character-api.ts:8`, `TownRoom.ts:2369`

**Decision made.** There are no accounts, passwords, or session tokens. A character
is identified by a `characterId` (UUID) persisted in the browser's `localStorage`.
`onJoin` loads whatever `characterId` is sent; it only checks `accountName` *if the
client chooses to send one*. `GET /api/characters?accountName=<anything>` is
unauthenticated and lists that account's character IDs. Verified live: a fresh
client joined with another character's `characterId` and no account name and fully
controlled that character.

**Alternative A — Accounts with server-issued session tokens.** A real `accounts`
table (hashed password / magic link), an `onAuth` that verifies a signed token, and
`characterId` scoped to the authenticated account.
- *Pros:* Closes impersonation; is the minimum bar for any internet exposure;
  Colyseus has a first-class `onAuth` hook for exactly this.
- *Cons:* A few days of work (auth UI, token lifecycle, password reset).

**Alternative B — Delegated identity (OAuth / third-party).** Sign in with an
existing provider; the server trusts a verified external identity.
- *Pros:* No password storage; fast for users; offloads credential security.
- *Cons:* External dependency and config; still need account↔character mapping;
  privacy considerations.

**Honest evaluation.** For a purely local, single-player-on-localhost demo, "no
auth" is a defensible scope cut — and the roadmap does defer production
deployment. But it is presented alongside a README that invites sharing a public
tunnel URL with other players, and in that context it is a critical hole: the
character ID is both the only credential *and* publicly enumerable via the HTTP
endpoint, so anyone can take over any character. This is a decision by omission
that was never surfaced as a risk. **Verdict: fine for localhost, unacceptable for
any shared/public use — must implement Alternative A before exposure.**

---

## ITD-6 — Message-level test gate over a shared pure-rules library

**Cross-ref:** AD-009, AD-010, AD-014; `libs/game-core`, `server/src/rooms/town-room-harness.ts`

**Decision made.** Game rules live in a shared `libs/game-core` consumed by both
server and client, with all randomness through an injected seeded RNG. The quality
gate is three test layers — unit, Colyseus room-integration (real rooms, real
message delivery, deterministic `tick()` under `NJ_AUTOSIM=0`), and seed/data — and
"the gate decides done." 1,208 tests pass. There are no E2E/browser tests despite
Playwright being installed.

**Alternative A — Add a thin end-to-end layer driving the client's own code.** Keep
the three layers, but add one smoke test per feature that logs in through the real
client and exercises *its* send-functions and DOM, not raw `room.send`.
- *Pros:* Catches the exact class of defect this gate missed — features whose
  server half is tested but whose client half can't invoke them (trade, party
  accept, PvP target, craft/enchant dialogs are all unreachable in the running
  game yet "verified"). A handful of tests would have caught all of it.
- *Cons:* E2E is slower and flakier; needs a headless browser in CI.

**Alternative B — Property-based / adversarial testing on handlers.** Fuzz every
handler with `NaN`, `Infinity`, negatives, fractional and oversized inputs.
- *Pros:* Directly targets the missing validation layer; a server-authority claim
  rests on surviving hostile input.
- *Cons:* More setup; can surface many findings at once.

**Honest evaluation.** The shared-rules + seeded-RNG + room-integration design is
genuinely strong and is why the server tests are fast, deterministic, and
meaningful (~75–90% of them are real behavioral tests). But the gate is
*message-level*, so features pass by sending a message the real client can never
send — the tests verified correctness at the one layer exercised and were blind to
the layer that wasn't. The gate also validated only *legitimate* input, never an
adversary, which is how the validation gaps and a broken production build slipped
through as "verified." **Verdict: excellent foundation with two specific blind
spots (no client-driven E2E, no adversarial input) that account for most of the
project's inflated claims.**

---

## ITD-7 — Client rendering: eager, uncompressed rigged-GLB assets

**Cross-ref:** AD-005 (superseded) → AD-017, AD-019; `client/public/models` (95 MB), `scene/`

**Decision made.** The original decision (AD-005) was procedural low-poly
primitives only, no asset files. It was reversed (AD-017) to license-clean rigged
GLB meshes loaded via `GLTFLoader` + `AnimationMixer`. In practice the world loads
~95 MB of uncompressed GLB (63 MB of NPC models alone) *eagerly* on entry, with no
DRACO/meshopt/KTX2 compression, no distance culling for NPCs, a serial load
waterfall, and no loading UI. A URL-keyed template cache exists but is defeated by
13 byte-identical meshes shipped under different filenames (a helper script,
`scripts/uniquify-glb.mjs`, exists specifically to make duplicates pass the dedup
gate). Several monster meshes are wrong-species stand-ins (Giant Spider → a flying
squid, Werewolf Chieftain → a mushroom).

**Alternative A — Same GLB pipeline, but compressed + lazy + deduped.** meshopt/DRACO
compression, KTX2 textures, distance-culled and `Promise.all`-loaded NPC models, a
real shared cache, and a loading screen.
- *Pros:* Cuts payload by ~5–10×; fixes the blank-screen-on-load UX; small, well-
  trodden changes with big wins.
- *Cons:* Adds a build/transcode step and a decoder dependency.

**Alternative B — Keep the original procedural primitives (AD-005).** No asset files
at all; everything generated in code.
- *Pros:* Near-zero payload; instant load; no license hygiene burden; fully
  deterministic and jsdom-testable.
- *Cons:* Much lower visual fidelity; can't hit the "real game character" goal that
  drove the reversal.

**Honest evaluation.** Reversing to rigged GLB (AD-017) was reasonable given the
stated goal — the animation pipeline (real `AnimationMixer`, crossfades, per-rig
clip maps) is genuinely well done. But the *asset delivery* decisions are poor:
95 MB eager and uncompressed with no loading feedback is a bad first-load
experience, and the dedup-defeating script plus wrong-species meshes mean the
"authentic, distinct, fidelity-gated creatures" claim is not true. Alternative A is
the same decision executed properly and should be the target. **Verdict: right
direction, weak delivery and a compromised asset-fidelity gate.**

---

## Summary table

| ITD | Decision | Verdict |
| --- | --- | --- |
| 1 | Server-authoritative, intent-only | Right call, partially delivered (design ✓, validation ✗) |
| 2 | Single monolithic room / zone | OK for demo; biggest structural debt for scale |
| 3 | Per-call grid A\* pathfinding | Right feature, naive data structures; cheap to fix |
| 4 | SQLite + debounced non-transactional saves | Right engine, unsafe write path; fix is mandatory |
| 5 | `characterId` identity, no auth | Fine for localhost, unacceptable when shared/public |
| 6 | Message-level test gate + shared rules lib | Strong foundation; blind to client-E2E & adversarial input |
| 7 | Eager uncompressed rigged GLB assets | Right direction, weak delivery; fidelity gate compromised |

**Cross-cutting theme.** The hard, structural decisions (1, 4-engine, 6-foundation)
were made well; the decisions were let down by *execution details* that a real
adversary or a single manual play-through would have caught — missing input
validation, unsafe save transactions, no client-driven testing, and an asset
pipeline that games its own gate. This is the consistent signature of competent
spec-driven work with no adversarial or end-to-end check in the loop.
