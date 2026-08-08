# Important Technical Decisions Register — NJ-MMO

> Independent register of the most consequential decisions actually implemented
> in the repository. Audited 2026-08-09 against code baseline `7bba727` and the
> initial Claude review at `44592e8`. This complements, rather than replaces, the
> append-only AD log in `.specs/STATE.md`.
>
> Each entry records the current decision, two credible alternatives, trade-offs,
> and an independent verdict. “Recommended” means the best next-state for the
> stated product direction, not that the prototype should have implemented every
> production concern on day one.

## ITD-01 — Authoritative server with intent-only client messages

**Cross-reference:** AD-001, AD-008, AD-018

**Decision implemented.** A Colyseus `TownRoom` owns gameplay state. The client
sends intents such as move, attack, skill, purchase, and interaction; it does not
submit final positions, damage, XP, or balances. The server validates movement,
runs pathfinding, advances the 50 ms simulation, and resolves combat/economy rules.

### Alternative A — Client prediction with authoritative reconciliation

The client immediately predicts movement/actions while the server still simulates
and periodically corrects it.

- **Pros:** Better latency feel; preserves server authority; standard approach for
  action-oriented online games.
- **Cons:** Requires snapshot/input sequencing, rollback or correction smoothing,
  and careful duplication of deterministic movement logic; does not remove the
  server's validation/simulation cost.

### Alternative B — Client-authoritative outcomes with server sanity checks

Clients submit resulting state and the server rejects only obvious anomalies.

- **Pros:** Lowest server CPU and simplest responsive prototype.
- **Cons:** Fundamentally unsuitable for a shared persistent economy; every
  outcome becomes a cheat surface and “sanity checks” become an endless security
  race.

### Evaluation

The implemented authority model is the correct foundation and one of the highest-
quality parts of the project. An isolated live probe confirmed out-of-bounds
movement rejection. The caveat is material: TypeScript handler types are not
runtime network schemas, and several quantity/text handlers lack finite, integer,
bounded, or type checks. Authority is only as strong as its input boundary.

**Verdict:** Keep. Add uniform runtime schemas and domain invariants before public
use; add client prediction only if latency measurements justify the complexity.

## ITD-02 — One full-world room per matchmade instance, with six logical zones

**Cross-reference:** AD-006, AD-013

**Decision implemented.** One Colyseus room type, `town`, contains the complete
Talking Island world and its six logical zone IDs. `TownRoom` coordinates sessions,
movement, mobs, combat, quests, economy, social systems, persistence, and schema
projection. Client-controlled `instanceKey` may create multiple independent copies
of that full world.

### Alternative A — Room per zone with explicit handoff

Each logical zone is an independently simulated room; crossing a boundary moves
the player between rooms.

- **Pros:** Natural CPU/state partitioning; smaller room classes; failures and hot
  populations are isolated.
- **Cons:** Requires durable handoff plus cross-room presence, party, chat, trade,
  friend, and quest coordination. Seamless borders become a distributed-systems
  problem.

### Alternative B — One logical world with interest-managed spatial workers

Partition simulation and replication into cells/shards while maintaining a shared
world identity and cross-cell services.

- **Pros:** Highest scale ceiling; sends each client only nearby state; supports
  dense and sparse areas efficiently.
- **Cons:** Substantially more engineering and operations; requires distributed
  ownership, migration, failure recovery, and observability. Premature for an MVP.

### Evaluation

One room was a sound vertical-slice choice. It is not a production MMO topology.
The room is already about 2,600 lines, replicates the complete mob map, has no
finite `maxClients`, and creates its own DB connection and tick loop. Arbitrary
`instanceKey` values can allocate full room copies. Same-character eviction is
room-local, so two instances can concurrently write the same character.

**Verdict:** Acceptable prototype decision. First add admission limits, authenticated
room assignment, and measured load targets. Choose zone rooms or spatial workers
only from those measurements.

## ITD-03 — Synchronous per-intent grid A\* pathfinding

**Cross-reference:** AD-018

**Decision implemented.** Movement intents run octile-heuristic A\* on a 630 x 630,
one-metre walkability grid covering slopes, water, buildings, and landmarks. The
server follows returned waypoints authoritatively. Each call allocates two full
`Float64Array`s and one `Int32Array` (about 7.94 MB before Set overhead); a
`Set<number>` open list is linearly scanned for the lowest score.

### Alternative A — Heap A\* with reusable/generation-stamped buffers

Retain the same grid and paths but use a priority queue and reuse scratch arrays.

- **Pros:** Preserves existing semantics/tests; reduces open-list selection from
  linear to logarithmic behavior; removes most allocation/fill churn.
- **Cons:** More data-structure code and buffer lifecycle discipline; paths are
  still grid-like and queries remain synchronous unless additionally scheduled.

### Alternative B — Navmesh/hierarchical pathfinding with a work budget

Represent walkable regions at a coarser level, query a navmesh or hierarchical
graph, and schedule expensive requests outside the main tick budget.

- **Pros:** Fewer nodes, smoother paths, better long-distance behavior, and a
  clearer route to bounded per-tick work.
- **Cons:** Requires generation/tooling and more complex deterministic tests;
  dynamic obstacles and path invalidation need an explicit design.

### Evaluation

Real server pathfinding is a strong prototype feature; the data structures are
naive. On this host the first grid build took about 512 ms, while warm representative
paths had medians from about 5 ms to 68 ms. One long request can exceed the 50 ms
tick budget. The initial Claude review's “around 20 players” capacity threshold is
not defensible without a specified workload and load test.

**Verdict:** Keep the behavior, replace the implementation with Alternative A,
then load-test before committing to a navmesh or distributed topology.

## ITD-04 — SQLite/Drizzle with debounced aggregate persistence

**Cross-reference:** AD-007, AD-011

**Decision implemented.** Runtime data uses better-sqlite3 in WAL mode behind
Drizzle. Most routine aggregate mutations schedule a five-second debounced save;
leave/drop, death, kills, and several subsystem paths also persist immediately. One
aggregate save performs a character upsert followed by three independent
delete-and-reinsert operations for inventory, equipment, and skills. Warehouse and
quest writes use additional paths. Two-player trade persists the players
sequentially. Only the seed pipeline uses `db.transaction`.

### Alternative A — Transactional SQLite aggregate (recommended next state)

Keep SQLite/Drizzle, but write the complete character aggregate and every multi-
party invariant inside explicit transactions; use one migration system and managed
connection ownership.

- **Pros:** Smallest architectural change; removes delete/insert data-loss windows;
  makes trades and snapshots crash-consistent; SQLite remains excellent for a
  single-process prototype.
- **Cons:** Transactions must remain short and off latency-sensitive tick work;
  failure/retry semantics and connection shutdown need tests.

### Alternative B — Network database plus durable service boundary

Move persistence to Postgres (optionally behind a dedicated service/outbox) with
transactions, concurrency control, migrations, and pooling.

- **Pros:** Better multi-process concurrency, operational tooling, constraints,
  and horizontal-room readiness.
- **Cons:** More operational complexity and latency; switching engines alone does
  not fix bad aggregate boundaries or missing transactions.

### Evaluation

SQLite-first was sensible. The unsafe part is the write model, not the engine. A
process failure or insert error after a committed delete can empty a collection;
sequential trade saves can persist only one side. The DB schema also lacks strong
foreign-key/check constraints. `getDb()` creates a native connection per room and
per character-list request without explicit reuse/close ownership.

**Verdict:** Keep SQLite until scale requires otherwise, but implement Alternative
A before real players or valuable state are admitted.

## ITD-05 — Character UUID and caller-supplied account name as identity

**Cross-reference:** no explicit original AD; implemented in `TownRoom.onJoin` and
`/api/characters`

**Decision implemented.** There is no authenticated account/session principal.
The browser stores a character UUID in `localStorage`; the server loads any
supplied UUID. It compares `accountName` only if the caller supplies one. The
character-list endpoint accepts an account name without credentials and returns
matching UUIDs.

### Alternative A — First-party accounts and server-issued sessions

Authenticate credentials or magic links, issue short-lived signed/opaque sessions,
and authorize character selection against the server-established account ID in
`onAuth`/room admission.

- **Pros:** Full control of account lifecycle and character ownership; supports
  revocation, moderation, recovery, and auditing.
- **Cons:** Password/session security, rate limiting, recovery, email, privacy, and
  account UI become permanent product responsibilities.

### Alternative B — Delegated identity with local authorization

Use a trusted OIDC/OAuth provider for sign-in, then map its stable subject to local
accounts/characters and issue the game's own session.

- **Pros:** Avoids storing passwords; proven MFA/recovery can be delegated; often
  faster to secure correctly.
- **Cons:** Provider dependency and configuration; privacy/availability concerns;
  local authorization and session security are still required.

### Evaluation

No auth is defensible only for an explicitly local demo. The package contains a
`start:tunnel` workflow that prints “Share this URL with players,” making the scope
boundary unsafe. A live isolated probe listed a UUID for a known account name and
used that UUID alone to join and control the character. Account names are not
globally listed by this endpoint, so “all IDs are publicly enumerable” is too broad,
but the takeover remains a critical release blocker.

**Verdict:** Reject for any shared deployment. Authentication/authorization is a
new cross-cutting subsystem and must precede public multiplayer exposure.

## ITD-06 — Shared pure rules plus unit/room/seed test gate

**Cross-reference:** AD-009, AD-010, AD-014

**Decision implemented.** `libs/game-core` contains pure rules shared by client and
server; gameplay randomness is generally injected. The suite has three layers:
unit, real Colyseus room integration, and seed/data tests. Current inventory is
1,208 passing tests in 179 files: 287 game-core, 483 server, and 438 client. The
previous browser E2E project was removed.

### Alternative A — Keep the layers and add a thin browser journey gate

Add a small Playwright suite that starts the built client/server and exercises one
real player journey per composed feature.

- **Pros:** Detects orphan UI, missing send-sites, connection failures, bad setup,
  and production-bundle defects—the exact seam current tests missed.
- **Cons:** Slower and more environment-sensitive; needs disciplined selectors,
  deterministic server control, and a deliberately small scope.

### Alternative B — Contract/property testing at every network boundary

Define executable schemas and generate valid/invalid payloads, including non-
finite, fractional, oversized, wrong-type, and malformed cases.

- **Pros:** Makes server authority measurable; catches economy corruption and
  handler crashes cheaply; complements room tests without a browser.
- **Cons:** Does not prove that real UI journeys are reachable; generators and
  domain invariants require ongoing maintenance.

### Evaluation

The test investment is genuine: server coverage shape is 231 TownRoom integration,
147 seed/data, 45 DB, and 60 other unit tests. But there is no normal coverage
threshold or CI; server Vitest retries once and disables file parallelism; Nx
flagged it flaky; 15 real waits remain in room specs; `game-core` has no lint
target; and the production build fails. Isolated UI tests directly render orphaned
craft/enchant modules, so they prove components rather than player journeys.

**Verdict:** Strong foundation, incomplete release gate. Adopt both alternatives:
contract fuzzing for authority and a very small browser suite for composition.

## ITD-07 — Rigged GLB rendering pipeline and current asset-delivery policy

**Cross-reference:** AD-005 (superseded), AD-017, AD-019

**Decision implemented.** The project reversed an initial procedural-primitive
decision and adopted license-clean GLBs, `GLTFLoader`, `AnimationMixer`, crossfades,
URL-template caching, skeleton-aware cloning, instanced scatter, and distance-based
mob rendering/animation. The repository ships 64 GLBs totaling 93.86 MiB.

### Alternative A — Same pipeline, compressed/lazy/deduplicated (recommended)

Preserve GLB animation but add meshopt/DRACO geometry, KTX2/WebP texture policy,
semantic deduplication, parallel prioritized loads, NPC/environment distance
budgets, and progress/error UI.

- **Pros:** Retains the good animation investment; substantially improves first
  load, memory, bandwidth, and transparency.
- **Cons:** Adds transcoding/decoder tooling and browser/device compatibility
  testing; aggressive compression can affect quality.

### Alternative B — Procedural/stylized primitives

Return to code-generated low-poly geometry and limited procedural animation.

- **Pros:** Tiny payload, deterministic generation, easy license provenance, and
  excellent iteration speed.
- **Cons:** Lower visual appeal and creature identity; cannot meet the stated
  rigged-character fidelity goal.

### Evaluation

The animation/rendering architecture is thoughtful. Delivery and governance are
not. About 66 MiB of unique NPC models begins loading on entry, plus environment,
player, and nearby mobs; there is no dedicated progress UI. Geometry is not
DRACO/meshopt compressed, although 26 GLBs use WebP textures. There are 13
redundant semantic model copies, not literal byte-identical files:
`uniquify-glb.mjs` changes metadata so raw hashes pass. Several creature mappings
are visibly wrong-species substitutions despite a fidelity PASS.

**Verdict:** Keep the rigged pipeline, implement Alternative A, and make fidelity
and license review evidence-based rather than hash/gate-based.

## ITD-08 — Import L2J Classic data into an owned schema; never depend on L2J

**Cross-reference:** AD-001, AD-002, AD-010

**Decision implemented.** L2J Mobius Classic is a reference-only source. Build-time
seeders parse selected open-source XML into NJ-MMO's own SQLite schema; tests use a
committed representative fixture subset. Game mechanics are translated into
TypeScript rules. L2J is not a runtime dependency and the real L2 protocol/assets
are excluded.

### Alternative A — Hand-curated native game data only

Define every NPC, item, skill, curve, spawn, and rule directly in NJ-MMO-owned JSON,
TypeScript, or database migrations.

- **Pros:** Simple provenance and schema; no importer drift or external source-tree
  requirement; full control over balance and terminology.
- **Cons:** High manual transcription cost and error rate; loses a valuable
  reference for coherent Classic mechanics and data relationships.

### Alternative B — Runtime L2J service/protocol integration

Run L2J as the game server or query it as a live dependency while the browser
client translates/adapts its protocol.

- **Pros:** Reuses a mature content/rules implementation and broader ecosystem.
- **Cons:** Defeats the authoritative TypeScript architecture, introduces a second
  runtime and protocol bridge, complicates browser compatibility/licensing, and
  makes NJ-MMO unable to evolve independently.

### Evaluation

The implemented decision is excellent for this project's stated goals: it imports
knowledge while retaining ownership of runtime behavior. Fixture-driven parser
tests are valuable. Risks remain: the default seed path is developer-machine
specific; schema/source version provenance is not pinned in generated data; the
README seed command currently fails without the server tsconfig; and current
`fast-xml-parser` has a high advisory (low current exploitability because input is
trusted local reference data).

**Verdict:** Keep. Pin/source-document the L2J revision, validate generated data in
CI, fix the seed command, and treat imported data/licensing provenance as a formal
release artifact.

## Summary

| ITD | Current decision                          | Independent verdict                                          |
| --- | ----------------------------------------- | ------------------------------------------------------------ |
| 01  | Server-authoritative intent model         | Correct foundation; runtime schemas missing                  |
| 02  | Full world in one room, six logical zones | Good MVP cut; not a scale architecture                       |
| 03  | Synchronous grid A\* per move intent      | Correct behavior, inefficient implementation                 |
| 04  | SQLite/Drizzle debounced saves            | Right engine, unsafe non-transactional aggregate             |
| 05  | UUID + caller account name identity       | Critical blocker for any shared deployment                   |
| 06  | Shared rules + unit/room/seed tests       | Strong investment; composition/security/release blind spots  |
| 07  | Rigged GLB client pipeline                | Good rendering primitives, poor delivery/governance          |
| 08  | L2J as seed/rules reference only          | Excellent project-specific decision; improve reproducibility |

The pattern is consistent: foundational prototype choices are often sound, while
cross-cutting product concerns—identity, transactions, input schemas, lifecycle,
end-to-end composition, release automation, and measured capacity—were either
deferred or declared complete too early.
