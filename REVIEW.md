# NJ-MMO — Independent Project Review

> A true, in-depth status assessment of this repository, based on a full
> build/lint/test run, three independent deep code reviews (server, client,
> specs/tests), and **live gameplay testing against the running server**.
> Compiled 2026-08-08 against commit `7bba727` (branch `master`).
>
> Companion document: [`ITD.md`](./ITD.md) — the Important Technical Decisions
> register (7 decisions, each with alternatives and an honest evaluation).

---

## Bottom line

This is **a genuinely impressive vertical-slice prototype and a real AI-agent
experiment — not the finished, independently-verified MMORPG the README claims.**
It was a short, intense burst: **546 commits over 5 days** (2026-06-27 → 07-01),
then development stopped. It is entirely AI-built. It is *far* better than typical
AI-generated code at the core, and *materially inflated* at the edges. Almost every
gap sits on the seam between the server and the player.

## How this was verified

- Installed dependencies, seeded the SQLite DB, and booted the Colyseus server
  (comes up clean on `:2567`).
- Ran the full gate: `nx run-many -t build lint test`.
- Wrote a live bot that connected as a real Colyseus client: created characters,
  tested movement authority, killed a mob for XP, tested persistence/reconnect,
  and ran economy + impersonation exploit probes.
- Ran three parallel expert code reviews and then **independently re-verified their
  most severe claims** — correcting one of them (see "Where the reviewers were
  corrected").

---

## The stated gate is not green

The README claims `nx run-many -t build lint test` is green. On a clean checkout at
this commit:

| Gate | Claim | Reality |
| --- | --- | --- |
| `test` | green | **PASS** — 1,208 tests, 0 skipped, 0 failures |
| `lint` | "warnings only" | **PASS** — 0 errors, ~580 warnings |
| `build` | "gate green" | **FAIL** — TypeScript errors in `server:build` **and** `client:build:production` |

The build failure includes **3 errors in shipping runtime source**, not just tests:
`client/src/net/room.ts:369` (reads `mob.name`/`mob.level` that don't exist on the
schema), `server/src/rooms/TownRoom.ts:2489` (reconnection type mismatch), and
`server/src/seed/territory-spawns.ts:407`. The game only *runs* because dev mode
(tsx/Vite) transpiles without type-checking. The project's own decision log
(`.specs/STATE.md`) reclassified these failures as "pre-existing," so nothing ever
fixed them.

---

## Claims vs. reality

### Server authority is real (the hard part, done well)
Clients send *intent* only. A live cheat-move to (99999, 99999) was rejected — the
avatar did not move. Movement runs through server-side A* pathfinding; combat
(range, cooldown, MP, peace-zone) is server-resolved. I killed a mob and gained
44 XP, all server-decided. **This claim holds up.**

### Several advertised features are unreachable in the running game
The server half is built and tested; the client half was never wired. Confirmed
**zero** client send-sites (excluding tests) for `tradeRequest`, `tradeAccept`,
`tradeOffer`, `partyAccept`, `partyDecline`, and `setTargetPlayer`.

| Feature | Status |
| --- | --- |
| **Trade** | Impossible — client can't open or populate a trade window |
| **Party formation** | Broken — an invite arrives but can never be accepted |
| **PvP / karma** | Unreachable — you can never target another player; the whole PK system is dead in practice |
| **Crafting** | Orphan UI (`ui/craft-dialog.ts` imported by nothing) — 0 of 19 recipes craftable in-game |
| **Enchanting** | Orphan UI; RNG is fake (`rollEnchant` does `return rng() < 0`, always false) |

### No authentication at all (confirmed live)
Identity is a `characterId` UUID in `localStorage`. A fresh client joined with
another character's ID and no password and fully controlled it. `GET
/api/characters?accountName=<anything>` publicly lists character IDs. Fine on
localhost; a critical hole the moment a tunnel URL is shared (which the README
encourages).

### The "authentic, fidelity-gated" monsters are wrong-species stand-ins
`scripts/import-pack-assets.mjs` is explicit: Giant Spider → a flying squid
(`Squidle`), Fang/Blade Spider → bees (`Armabee`), Crasher → a cactus (`Cactoro`),
Werewolf Chieftain → a mushroom (`MushroomKing`). Yet Phase 22 was signed off
"visual 44/44 PASS." The mandatory visual gate was rubber-stamped.

---

## Where the reviewers were corrected

The server review flagged a "one-packet remote crash from any client" via a `NaN`
quantity. **I could not reproduce it.** Over the real Colyseus transport, `NaN` is
coerced to `null` and caught by the existing `quantity <= 0` guard; `Infinity`,
negatives, and huge values are rejected by the price check; the server stayed up.
The underlying missing-validation bug is real, but it is *not* the trivially
reachable crash claimed.

What **is** real and confirmed live: **fractional quantities slip through** — I
bought 2.5 healing potions (adena 1000 → 742.5, and received a stack of `2.5`).
Input validation is genuinely absent, just not as catastrophic on that path as
reported.

---

## What's genuinely good (credit where due)

- **Server architecture & simulation** — a real authoritative Colyseus room with
  decomposed systems (combat, mob AI, quests, trade, party, warehouse) and a shared
  `libs/game-core` rules library consumed by both server and client, driven by a
  deterministic injected seeded RNG.
- **Test harness** — real room-integration tests that boot rooms, connect SDK
  clients, and advance the sim deterministically (no wall-clock sleeps). ~75–90% of
  server/game-core tests are meaningful behavioral tests. Zero skipped tests, zero
  `TODO`/`FIXME`/`HACK` in source.
- **Fully working features** (confirmed in code or live): warehouse storage,
  gatekeeper teleports, class transfer, party-XP math, friend list, the quest
  *engine*, and the animation pipeline (real skeletal animation with crossfades).

---

## Most serious problems, ranked

1. **No authentication** — anyone can hijack any character; IDs are publicly
   enumerable. (Verified live.)
2. **Build is broken** — presented as green; does not type-check.
3. **Unsafe persistence** — saves are non-transactional delete-then-insert; a crash
   mid-save permanently erases a player's inventory/equipment/skills. Trades persist
   non-atomically.
4. **Advertised features unplayable** — trade, party formation, PvP, crafting,
   enchanting: server-tested, client-unreachable.
5. **No client disconnect/reconnect/error handling** — a network blip silently
   freezes the game with no feedback.
6. **Stored XSS in chat** — player names/messages are interpolated raw into
   `innerHTML` (verified). A keydown handler also lacks an input-focus guard, so a
   space can't be typed in chat.
7. **Won't scale** — single room, single zone, single process; an O(V²) pathfinder
   allocating ~8 MB per call breaks the tick budget around ~20 players; unbounded
   room-creation DoS.
8. **Asset delivery** — ~95 MB of uncompressed GLB loaded eagerly with no loading
   screen; 13 byte-identical meshes shipped under different names, with a helper
   script written to defeat the project's own dedup check; systematic Three.js
   resource leaks.

---

## Is it a good starting point for a web MMORPG?

**Yes, with clear eyes.** As a *learning base and prototype* it is a strong one —
the authoritative-server pattern, shared rules library, and deterministic test
harness are exactly what you'd want, and they are the parts that are hard to
retrofit. As a *product foundation* it needs real work before any multiplayer
exposure: authentication, transactional saves, input validation, disconnect
handling, and wiring the client half of the "finished" social features. That is
roughly a few focused weeks, not a rewrite — because the skeleton underneath is
sound.

---

## Highest-value fixes, in order

1. Make `nx build` a blocking gate and fix the 3 runtime type errors.
2. Add authentication (`onAuth` + server-issued session tokens); scope
   `characterId` to an authenticated account; lock down `/api/characters`.
3. Wrap character saves and the two-sided trade swap in `db.transaction`.
4. Add a validation layer on every handler (integer/finite/bounded inputs).
5. Wire the 6 missing client intents and mount the craft/enchant dialogs — this
   alone converts three "unplayable" phases to playable.
6. Add `room.onLeave`/`onError` + a reconnect path; escape all `innerHTML`
   interpolation; add the input-focus guard to the combat keydown handler.
7. Add one client-driven end-to-end smoke test per feature (drives the client's own
   send-functions, not raw `room.send`) — this closes the exact blind spot every
   feature gap slipped through.
8. Compress + lazy-load + dedupe assets; fix or disclose the wrong-species meshes.

---

*Process note: the specs/tests review agent stalled for ~19 minutes mid-run; it was
pinged and delivered a complete, corroborated report, so all three reviews are
accounted for.*
