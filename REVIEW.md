# NJ-MMO — Independent Project Status and Architecture Review

> Audit date: 2026-08-09. Code baseline: `7bba727`; Claude review baseline:
> `44592e8`. This revision independently checks Claude's report with clean build,
> lint, direct test, seed, dependency, static-analysis, benchmark, and isolated
> live-SDK evidence. Companion decision register: [`ITD.md`](./ITD.md).

## Executive verdict

NJ-MMO is a substantial and unusually coherent **browser-MMO vertical-slice
prototype**. Its authoritative server, shared game-rule library, deterministic
randomness, real Colyseus room tests, L2J-derived seed pipeline, and skeletal
animation pipeline are valuable building blocks.

It is **not a safe or client-complete product foundation in its current state**.
The production build fails, player identity is unauthenticated, persistent economy
writes are not atomic, several advertised workflows cannot be initiated through
the real client, runtime payload validation is inconsistent, and there is no
release CI or browser end-to-end gate. Public multiplayer deployment should be
treated as blocked.

Claude's central conclusion was right, but several details were inaccurate or too
confident. Most importantly:

- The build has **19 TypeScript diagnostics**, including **five in non-test source
  across three files**, not three runtime errors.
- Current Colyseus MessagePack transport preserves `NaN`; Claude's claim that it
  becomes `null` and is safely rejected is wrong. The invalid value can corrupt
  live state and cause a delayed SQLite `NOT NULL` persistence failure.
- Safe enchanting through +3 deliberately has 100% success in the specification;
  `rng() < 0` is dead/nonsensical code, not evidence that scoped enchant outcomes
  are wrong.
- The repository ships 93.86 MiB of GLBs, but not all of it is fetched eagerly.
  Roughly 66 MiB of unique NPC models starts loading on entry, plus environment,
  player, and nearby-mob assets.
- “Entirely AI-built” is the owner's self-attested claim, strongly consistent with
  the artifacts and pace, but not independently provable from Git metadata.

## Architecture at a glance

```text
Browser / Three.js client
  UI + input -> intent messages -> Colyseus SDK
  renderer <- replicated TownState + server messages
                         |
                         v
One authoritative full-world TownRoom per matchmade instance
  sessions + movement + combat + mobs + quests + economy + social systems
  default client converges on one; instanceKey can create full copies
  50 ms simulation tick; all six logical zones in each replicated world
       |                    |
       v                    v
libs/game-core         SQLite / Drizzle
pure rules, RNG,       character state + L2J-derived seed data
movement, combat
```

The separation of pure rules from transport and rendering is a sound choice. The
main architectural problem is composition: `TownRoom.ts` is about 2,600 lines and
`client/src/net/room.ts` about 1,500 lines, so each side has become a lifecycle and
integration “god module” despite several well-extracted subsystems.

## Building-block quality

| Area                       | Prototype quality | Product readiness | Honest assessment                                                                                                                                 |
| -------------------------- | ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server authority           | High              | Medium            | Correct intent-only model; movement/combat outcomes are genuinely server-owned, but authority is weakened by incomplete runtime validation.       |
| Shared game rules          | High              | Medium-high       | Pure TypeScript rules and injected RNG are reusable and testable. Some server orchestration still duplicates invariants.                          |
| Colyseus room integration  | Medium-high       | Low-medium        | Real room/message tests are valuable; single-room topology, full-world replication, unbounded instances, and room-local identity prevent scaling. |
| Persistence                | Medium            | Low               | SQLite/WAL/Drizzle is sensible for an MVP; aggregate saves and trades are non-transactional and DB connections are not managed cleanly.           |
| Client rendering           | Medium-high       | Low-medium        | Good GLTF cloning, animation, instancing, mob culling, and render-state projection; poor teardown, connection lifecycle, and asset delivery.      |
| Client product integration | Low               | Low               | Multiple isolated UI modules are orphaned or cannot be reached through real player journeys.                                                      |
| Security                   | Low               | Blocked           | No authenticated identity, inconsistent payload validation, raw HTML sinks, and cross-room duplicate-session risk.                                |
| Test suite                 | Medium-high       | Medium-low        | Large and behavior-heavy, but no browser E2E, no coverage threshold, noisy/flaky behavior, real waits, and a broken build accepted as complete.   |
| Release/operations         | Low               | Blocked           | No CI workflow, broken production build, dev mode hardcoded, no deployment/observability/scaling story.                                           |

## What was actually run

All destructive/runtime probes used an isolated temporary SQLite database. No
real player data or public service was targeted.

| Check                               | Result                                                                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx nx run-many -t build --all`    | **FAIL** in 4.7 s. Client: 17 diagnostics; server: 2.                                                                                                                                   |
| ESLint over client + server         | **PASS with 578 warnings** across 59 files: 530 non-null assertions and 48 unused symbols. `game-core` has no lint target.                                                              |
| Direct game-core Vitest             | **PASS**, 52 files / 287 tests, 3.4 s wall time.                                                                                                                                        |
| Direct client Vitest                | **PASS**, 88 files / 438 tests, 13.7 s wall time; emitted five jsdom canvas diagnostics.                                                                                                |
| Direct server Vitest                | **PASS**, 39 files / 483 tests, about 89 s wall time. Slowest individual test observed: 746 ms.                                                                                         |
| Total                               | **1,208 tests passed**, no static `.skip`, `.todo`, `.only`, `xit`, or `xdescribe`.                                                                                                     |
| Nx cached test invocation           | Exit 0, but Nx explicitly reported `server:test` as flaky.                                                                                                                              |
| README seed command                 | **FAIL**: `npx tsx server/src/seed/cli.ts` cannot resolve `@nj/game-core`, even after the shared build.                                                                                 |
| Seed with server tsconfig           | **PASS** in 0.8 s using `npx tsx --tsconfig server/tsconfig.app.json ...`. Produced 23 monsters, 182 spawns, 26 NPCs, 87 items, 19 recipes, and 17 quests.                              |
| Server health                       | **PASS**: Nx dev server listened on `:2567`; `/health` returned 200.                                                                                                                    |
| Current production dependency audit | **11 vulnerable packages**: 3 high, 3 moderate, 5 low, 0 critical. Full tree: 31 total. Exploitability varies; `fast-xml-parser` is seed-time and currently parses trusted local input. |

The test counts are real and impressive. They do not make the full gate green:
the production build still fails.

### Exact build failure

There are 19 compiler diagnostics:

- Client non-test source: three diagnostics in `client/src/net/room.ts` around mob
  `name`/`level` merging.
- Server non-test source: one reconnection type diagnostic in
  `server/src/rooms/TownRoom.ts` and one seed-map type diagnostic in
  `server/src/seed/territory-spawns.ts`.
- Client tests: fourteen stale mock/fixture diagnostics in mob and remote-player
  specifications.

These errors were introduced in late commit `f8213f4` after Phase 29 had been
declared complete. Phase 30 called them “pre-existing” only relative to that phase;
they are not harmless historical debt. The README does not literally say the full
gate passes, but it labels `nx run-many -t build lint test` as the full gate while
advertising every phase as independently verified. The implication is not true.

## Live security and integrity probes

The following were reproduced through the official Colyseus SDK against the
temporary audit database:

| Probe                    | Observed result                                                                                                                                                                        | Severity                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Character listing        | `GET /api/characters?accountName=<known-name>` returned the character UUID without credentials. Account names are not globally enumerable by this API, so Claude overstated that part. | High enabler                |
| Character takeover       | A second client supplied only the listed UUID, joined successfully, saw the victim name, and controlled movement.                                                                      | Critical release blocker    |
| Fractional shop quantity | Buying `2.5` potions changed adena `1000 -> 742.5` and created a `2.5` stack.                                                                                                          | High economy integrity      |
| `NaN` shop quantity      | MessagePack preserved `NaN`; the handler accepted it into live state, and debounced persistence reached a SQLite `NOT NULL` failure.                                                   | High integrity/availability |
| Out-of-bounds movement   | A target far outside world bounds was rejected; position did not jump.                                                                                                                 | Authority control passed    |

The identity problem is more fundamental than “missing a login screen.”
`accountName` is caller-supplied data, not an authenticated principal. The server
checks character ownership only when the caller voluntarily sends an account name.
No password, signed token, OAuth subject, or `onAuth`-established identity exists.

The current `instanceKey` design adds another risk: single-session eviction is
room-local, so the same character can be active in two room instances and race
last-writer-wins persistence.

## Advertised feature reachability

The static content counts are mostly genuine: 23 monster IDs, 26 NPCs (README says
25), 87 items, 19 recipes, 17 quests, nine starter classes, and six logical zones.
The problem is not invented database content; it is whether the player can reach
the feature through the shipped client.

| Feature                                                                | Server/domain state                              | Real client state                                                                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Movement and mob combat                                                | Working and authoritative                        | Reachable                                                                                                                                       |
| Quests, shops, inventory, skills, warehouse, teleports, class transfer | Substantial server implementation/tests          | Mostly wired; not every full journey was manually replayed in this audit                                                                        |
| Trade                                                                  | Server handlers and room tests exist             | **Unreachable**: no request, accept, or offer workflow; window only confirms/cancels an already-open trade                                      |
| Party formation                                                        | Server handlers and tests exist                  | **Unreachable normally**: no incoming-invite UI/handler or accept/decline path; inviting relies on a global hook and player targeting is absent |
| PvP/karma                                                              | Server rules exist                               | **Unreachable**: renderer and combat input cannot select remote players or send `setTargetPlayer`                                               |
| Crafting                                                               | Rules, 19 recipes, and orphan dialog tests exist | **Unreachable**: dialog is never imported/mounted and exposes only one recipe                                                                   |
| Enchanting                                                             | Safe +1..+3 rules exist                          | **Unreachable**: dialog is never imported/mounted                                                                                               |

The enchant helper's `rng() < 0` branch is dead and should be removed, but the
specified MVP explicitly makes +1 through +3 guaranteed. Claude was wrong to call
the scoped RNG behavior “fake”; the reachability failure is the real defect.

## Security and durability findings

### Release blockers

1. **No authenticated identity.** Any known character UUID is a bearer credential;
   known account names disclose those UUIDs.
2. **No uniform runtime message schemas.** TypeScript annotations do not validate
   network payloads. Shop, warehouse, and trade quantities lack finite/integer
   constraints; chat assumes `text` is a string.
3. **Non-atomic persistence.** One character save is an upsert followed by three
   independent delete/reinsert collection saves. Warehouse is a separate fourth
   path. A failure can leave a mixed snapshot or an emptied collection.
4. **Non-atomic two-party operations.** Trade mutates both players in memory, then
   persists them sequentially. Tests prove live-state atomicity, not crash-safe DB
   atomicity.
5. **HTML injection.** Chat text is transient DOM XSS; a malicious persisted
   character name can create stored XSS when rendered in chat, party, or target
   UI. Raw strings are interpolated into `innerHTML`.
6. **Broken connection lifecycle.** The client has no runtime `onLeave`, `onError`,
   or reconnect path. The server offers a 30-second reconnection window that the
   browser does not consume.

### Important operational debt

- `getDb()` creates a native SQLite connection per room and per character-list
  request. Connections are neither shared nor explicitly closed, and schema setup
  runs repeatedly.
- `devMode` is hardcoded true; the room has no finite `maxClients`.
- Client-controlled `instanceKey` can create complete room/world copies, each with
  mobs, tick loop, and DB connection.
- Current dependency audit contains known advisories. There is no automated
  dependency or release gate.

## Performance and scaling

The current server is designed for a demo, not MMO scale:

- One room instance owns the whole world and replicates the full mob map. Client
  render-distance culling does not reduce server replication.
- Every movement intent runs synchronous grid A\*. Each call allocates two
  `Float64Array`s and one `Int32Array` for 396,900 cells—about 7.94 MB before Set
  overhead—and linearly scans the open set.
- On this host, warm representative routes had medians from about 5 ms to 68 ms.
  One long request can therefore exceed the 50 ms simulation budget. Claude's
  precise “breaks around 20 players” threshold is unsupported without a defined
  workload and load test.
- The mob tick builds the player list and evaluates all mobs against it; social
  assist scans peer mobs. These costs grow with world population.

Single-room is reasonable for a vertical slice. Before scale work, measure a
defined player/mob/message workload; then address heap-based/reusable pathfinding,
interest management, room admission, and zone/shard boundaries.

## Client and asset quality

Good choices include URL-keyed GLTF templates, `SkeletonUtils` cloning, instanced
scatter, range-culling for mobs, distance-based animation LOD, real animation
crossfades, and server-state projection.

The composition and lifecycle are weak:

- `wireRoom` mixes network adaptation, DOM updates, global test hooks, commands,
  and message handlers.
- The render loop's cancellation closure is discarded; logout disposes the
  WebGL renderer but leaves the RAF loop running.
- Re-entry accumulates global listeners and loops. Mob/NPC removal frequently
  removes nodes without disposing geometries, materials, mixers, or nameplates.
- A global combat key handler consumes Space even when chat input is focused, so
  typing a space sends an attack and prevents normal text entry.

Asset wording also needs precision. The repository contains 64 GLBs totaling
98,420,224 bytes (93.86 MiB). Geometry has no DRACO/meshopt compression, although
26 files use WebP textures. NPC entry starts roughly 66 MiB of unique model loads;
environment, player, and nearby-mob loads add more. The 13 redundant copies are
not byte-identical files: `uniquify-glb.mjs` alters metadata so raw hashes differ,
while the underlying model data remains duplicated. Several declared mappings are
wrong-species substitutes (spiders to bee/squid assets, werewolf chieftain to a
mushroom), contradicting the fidelity specification despite a PASS report.

## Test and specification quality

The suite represents serious work: 20,853 test lines versus 25,536 non-test
TypeScript lines. Server tests comprise 231 TownRoom integration tests, 147
seed/data tests, 45 DB tests, and 60 other units. Room tests really boot Colyseus,
connect SDK clients, deliver messages, and often drive simulation synchronously.

The gate is weaker than the repository's testing contract claims:

- No CI workflow and no coverage threshold/report in the normal gate.
- The previous Playwright E2E project was removed; nine validation documents still
  cite deleted E2E paths.
- Server Vitest uses one retry, disables file parallelism, allows 30-second tests
  and 120-second hooks, and the Nx run identified it as flaky.
- Fifteen real `setTimeout` waits remain in room integration specs, contradicting
  “no wall-clock sleeps.”
- All test configs permit `passWithNoTests`; `game-core` has no lint target.
- Nineteen validation files contain 32 `--skip-nx-cache` invocations, contrary to
  the current “never disable cache” rule.
- Phase validation is internally honest about some failures, but completion status
  is permissive: examples include surviving mutants, partially satisfied
  acceptance criteria, and Phase 30 accepting the broken full build.
- Twenty-four task documents still say Draft, 28 retain unchecked task boxes, and
  the README still says 29 phases although ROADMAP includes Phase 30.

The suite gives meaningful confidence in pure rules and many server handlers. It
does not prove real player journeys, hostile inputs, browser lifecycle, release
buildability, or production durability.

## Project history and AI provenance

The original history contains exactly 546 commits over 101.4 hours across five
author-date days (127 / 196 / 136 / 77 / 10 commits). All use the same Waldemar
Neto author/committer metadata, are unsigned, and have no AI/co-author trailers.
The original baseline then had no new commit for about 38 days before this review.

That pace, the specs, and the agent workflow strongly corroborate the README's
AI-experiment story. Git alone cannot prove every line was AI-generated or that a
Verifier was always independent: author dates are rewriteable and all original
commits share one human identity. The accurate wording is **owner-asserted and
strongly corroborated**, not independently proven.

## Is it a good starting point?

For learning, experimentation, or continuing this exact vertical slice: **yes**.
The hardest-to-retrofit choices—server authority, shared deterministic rules, and
room-level behavioral tests—are present.

For a publicly exposed web MMORPG product: **not yet**. Authentication is a new
cross-cutting subsystem, not a UI patch. It must be followed by transactional
durability, message schemas, browser session recovery, end-to-end feature wiring,
release automation, dependency remediation, and a measured scaling design. The
scope cannot responsibly be reduced to Claude's “few focused weeks” without
requirements, load targets, deployment architecture, and a security model.

## Recommended order of work

1. Restore a trustworthy gate: fix all 19 build diagnostics, correct the seed
   command, add CI, add lint for `game-core`, and remove flaky/retry masking.
2. Design authenticated accounts/sessions and character authorization. Disable
   public sharing until it is complete; make room admission derive identity from
   verified server context, never client-supplied account names.
3. Add runtime schemas for every message and HTTP input; require finite, safe
   integer, bounded quantities and fuzz the boundary.
4. Make character snapshots, trades, reciprocal friends, warehouse moves, and
   other multi-row invariants transactional; add failure-injection/reload tests.
5. Escape/remove raw `innerHTML` sinks and implement client disconnect/reconnect,
   teardown, and listener ownership.
6. Wire trade, party accept/decline, remote-player targeting, craft, and enchant
   through the real UI; add a thin browser E2E journey for each.
7. Profile a defined concurrency workload, then optimize pathfinding and choose
   room/interest-management boundaries from evidence.
8. Compress/lazy-load/deduplicate assets and replace or explicitly disclose
   wrong-species stand-ins.

## Audit limitations

This was a repository and local-runtime audit, not a penetration test, browser
compatibility matrix, visual art review, production load test, or disaster-recovery
exercise. Passing server implementations were sampled, not every advertised
quest/UI journey replayed manually. Findings distinguish reproduced behavior from
static inference, and exact concurrency capacity remains unmeasured.
