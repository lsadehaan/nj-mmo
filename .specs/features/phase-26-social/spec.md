# Phase 26 — Social & Multiplayer Systems Specification

## Problem Statement

Phases 3–25 deliver authoritative multiplayer movement, combat, economy, and quests — but
players cannot coordinate: no chat, no parties, no direct item exchange, and no persistent
friend list. Classic Talking Island is a social starter experience; without these systems
two browsers in the same room are strangers who cannot share XP, loot, or trade adena/items.

Phase 26 adds **server-validated** chat, party, trade, and friends — re-modeled from L2J
Classic rules (AD-003), not the real L2 protocol (AD-004). All outcomes are tested on the
server; the client renders and sends intents only (AD-001).

## Goals

- [ ] Chat channels **all / local / trade / party** with rate limiting and range rules.
- [ ] Party **invite → accept**, up to **5** members, leader kick/leave, replicated room state.
- [ ] **Shared party XP** and **party loot** on mob kill using L2J Classic distribution anchors.
- [ ] **Player trade window**: request → accept → dual-offer → dual-confirm → atomic swap.
- [ ] **Friend list** persisted per character with online status in-room.
- [ ] Room-integration tests: **two-session party kill** + **two-session trade**; client
      `wireRoom` maps social state to `__GAME_STATE__` (AD-009). **No Playwright.**

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Clans / alliances / command channel | ROADMAP post-TI |
| Mail system | ROADMAP post-TI |
| Private store / sell shop | ROADMAP Phase 24 deferred |
| Voice chat | Not Classic TI |
| Block / ignore list | Post-TI moderation |
| Party loot distribution modes (by turn, by leader) | MVP: random in-range member |
| Cross-room friends / global chat | Single `TownRoom` instance (AD-006) |
| Character rename / unique names enforcement | Phase 28 shell; friends use `characterId` |
| Playwright / `client-e2e` | Post-MVP gate (ROADMAP 19–29) |
| PvP / karma trade restrictions | Phase 27 |

---

## Assumptions & Open Questions

Autonomous Planner decisions (no user gate).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| AC prefix | **SOC26-NN** | Matches `ITEM25-NN`, `SKILL20-NN` | y |
| Chat max length | **120** chars | Classic chat line cap (approx) | y |
| Chat rate limit | **5** messages / **10 s** per session | Anti-spam; implicit dimension | y |
| Local chat range | **30** units horizontal (≈30 m) | TI slice scale; L2 shout ≈1250 units → ~12.5 m | y |
| Trade proximity | **3** units horizontal | L2 trade distance ≈250 units → ~2.5 m | y |
| Party proximity (XP/loot) | **15** units horizontal | L2J `AltPartyRange=1500` → ~15 m (AD-013) | y |
| Party max size | **5** | Classic party cap | y |
| Party XP bonus table | L2J `BONUS_EXP_SP`: `1.0, 1.3, 1.35, 1.4, 1.55, 1.6, 1.7, 1.8, 2.0` | Authentic Classic | y |
| Party XP split | `floor(pool × level² / Σlevel²)` per member; `pool = mobExp × bonus(memberCount)` | L2J `Party.distributeXpAndSp` | y |
| Party level cutoff | Member **>20** levels below party highest → **0** XP | L2J `PartyXpCutoffLevel=20`, LEVEL method | y |
| Party loot | Roll drops once; each stack → **random** eligible in-range party member (seeded RNG) | Classic random party loot MVP | y |
| Solo kill unchanged | Killer not in party → existing `handleMobKill` solo path | Regression guard | y |
| Party quest kill credit | Party members in range receive `onMobKilledForQuests` when any member kills | ROADMAP Phase 21 deferral | y |
| Trade atomicity | Single server transaction; rollback both sides on any validation failure | AD-001 inventory integrity | y |
| Trade quest items | **Rejected** from offers | Same as shop sell | y |
| Trade equipped items | **Rejected** — must unequip first | Prevents duped gear | y |
| Friends cap | **50** per character | Reasonable MVP bound | y |
| Friend key | `characterId` UUID; display `characters.name` | Name not unique today | y |
| Friend add target | Online: `targetSessionId`; offline: `targetCharacterId` | Room + persistence | y |
| Chat delivery | Server `broadcast` type `chat` + replicate last **20** lines in `__GAME_STATE__.chat` | AD-009 test hook | y |
| Party schema | `PartyState` on `TownState`; `PlayerState.partyId` | Colyseus replication | y |
| Implicit: auth | N/A — local Colyseus room | — | N/A |
| Implicit: concurrency | Per-test isolated room + temp DB (`instanceKey`, AD-014) | Existing pattern | N/A |

**Open questions:** none — all resolved or logged above.

---

## L2J Anchors

### Party XP bonus (`Party.java` `BONUS_EXP_SP`)

| Members in range | Multiplier on mob `exp` |
| ---------------- | ----------------------- |
| 1 (solo) | **1.0** |
| 2 | **1.3** |
| 3 | **1.35** |
| 4 | **1.4** |
| 5 | **1.55** |

### Party XP split anchor — Gremlin (npcId **20001**, exp **44**)

Two Human Fighters level **1**, both within **15** units of kill site:

| Player | Level | Share formula | XP granted |
| ------ | ----- | ------------- | ---------- |
| A (killer) | 1 | `floor(44 × 1.3 × 1² / (1²+1²))` | **28** |
| B | 1 | same | **28** |

Total distributed **56** (integer floor per member; remainder discarded — spec anchor).

### Party level cutoff anchor

Party highest level **25**; member level **4** (gap **21** > **20**):

| Player | XP from Gremlin party kill |
| ------ | -------------------------- |
| L25 killer | **>0** (per split) |
| L4 member | **0** |

### Trade flow (simplified L2 `TradeList`)

```
A: tradeRequest(B) → B: tradeAccept → [TRADING]
A: tradeOffer { items, adena }  ⇄  B: tradeOffer { items, adena }
A: tradeConfirm + B: tradeConfirm → atomic swap OR reject
```

### Chat channels (Classic mapping)

| Channel | Recipients |
| ------- | ---------- |
| `all` | Everyone in room |
| `local` | Players within **30** units of sender |
| `trade` | Everyone in room (trade advertising) |
| `party` | Current party members only |

---

## User Stories

### P1: Chat channels ⭐ MVP

**User Story**: As a player, I want to send messages on all/local/trade/party channels so I
can coordinate without external tools.

**Why P1**: Foundational social layer; every other feature benefits from feedback messages.

**Acceptance Criteria**:

1. **SOC26-01**: WHEN client sends `chat { channel: 'all', text }` with non-empty text
   ≤120 chars THEN server SHALL broadcast `chat` to every connected client with
   `{ channel, text, senderSessionId, senderName, timestampMs }`.
   **Test layer: room**
2. **SOC26-02**: WHEN `channel` is `local` THEN only clients whose player is within **30**
   horizontal units of sender SHALL receive the broadcast.
   **Test layer: room**
3. **SOC26-03**: WHEN `channel` is `party` and sender has `partyId=0` THEN server SHALL
   reject (no broadcast).
   **Test layer: room**
4. **SOC26-04**: WHEN `channel` is `party` and sender is in a party THEN only party member
   sessions SHALL receive the broadcast.
   **Test layer: room**
5. **SOC26-05**: WHEN sender posts **>5** messages within **10 s** THEN server SHALL reject
   the 6th with no broadcast.
   **Test layer: unit + room**
6. **SOC26-06**: WHEN `text` is empty or whitespace-only THEN server SHALL reject.
   **Test layer: unit**
7. **SOC26-07**: WHEN `text` length **>120** THEN server SHALL reject.
   **Test layer: unit**
8. **SOC26-08**: WHEN `wireRoom` receives a `chat` broadcast THEN `__GAME_STATE__.chat`
   SHALL append the message (max **20** retained).
   **Test layer: client unit**

**Independent Test**: Two clients in room; local message reaches nearby player only; `all`
reaches both.

---

### P1: Party invite & state ⭐ MVP

**User Story**: As a player, I want to invite another player to a party and see shared party
membership replicated in room state.

**Why P1**: Required before shared XP/loot and party chat.

**Acceptance Criteria**:

9. **SOC26-09**: WHEN leader sends `partyInvite { targetSessionId }` and target is online,
   unpartied, within **15** units THEN target SHALL receive `partyInvite` message with
   inviter session + name.
   **Test layer: room**
10. **SOC26-10**: WHEN target sends `partyAccept { inviterSessionId }` THEN a `PartyState`
    SHALL exist with both sessionIds, `leaderSessionId=inviter`, and both players'
    `partyId` set to the same non-zero id.
    **Test layer: room**
11. **SOC26-11**: WHEN party already has **5** members THEN `partyInvite` SHALL be rejected.
    **Test layer: room**
12. **SOC26-12**: WHEN player already in a party sends `partyInvite` THEN SHALL reject.
    **Test layer: room**
13. **SOC26-13**: WHEN member sends `partyLeave` THEN they SHALL be removed; if leader left
    and party non-empty, `leaderSessionId` SHALL transfer to the longest-tenured remaining
    member.
    **Test layer: room**
14. **SOC26-14**: WHEN leader sends `partyKick { targetSessionId }` THEN target SHALL be
    removed from party and `partyId` cleared.
    **Test layer: room**
15. **SOC26-15**: WHEN last member leaves THEN `PartyState` SHALL be deleted from room.
    **Test layer: room**
16. **SOC26-16**: WHEN `wireRoom` syncs local player with `partyId≠0` THEN
    `__GAME_STATE__.party` SHALL list member session ids and `leaderSessionId`.
    **Test layer: client unit**

**Independent Test**: Two-session invite → accept → party visible in state on both clients.

---

### P1: Shared party XP & loot ⭐ MVP

**User Story**: As a party member, I want XP and loot when my party kills a mob near me so
group grinding matches Classic expectations.

**Why P1**: Core ROADMAP deliverable; differentiates multiplayer from parallel solo play.

**Acceptance Criteria**:

17. **SOC26-17**: WHEN party of **2** at level **1** kills Gremlin (**44** exp) and both are
    within **15** units THEN each member's `xp` SHALL increase by **28** (anchor table).
    **Test layer: room (two-session)**
18. **SOC26-18**: WHEN party member is **>15** units from kill site THEN they SHALL receive
    **0** XP from that kill.
    **Test layer: room**
19. **SOC26-19**: WHEN party member is **>20** levels below party highest THEN they SHALL
    receive **0** XP from that kill.
    **Test layer: room**
20. **SOC26-20**: WHEN party kill rolls drops THEN each drop stack SHALL be added to
    inventory of a **random** in-range party member (same `combatRng` seed → deterministic
    in tests).
    **Test layer: room**
21. **SOC26-21**: WHEN solo player kills mob (not in party) THEN XP/loot SHALL follow
    existing solo `handleMobKill` (Gremlin → **+44** xp to killer only).
    **Test layer: room (regression)**
22. **SOC26-22**: WHEN party member in range has active kill quest for mob THEN
    `onMobKilledForQuests` SHALL run for that member (not only killer).
    **Test layer: room**

**Independent Test**: Two-session party kill Gremlin → both +28 XP; solo kill still +44.

---

### P1: Player trade ⭐ MVP

**User Story**: As a player, I want a secure trade window to exchange items and adena with
another player nearby.

**Why P1**: ROADMAP explicit deliverable; completes peer economy without private stores.

**Acceptance Criteria**:

23. **SOC26-23**: WHEN A sends `tradeRequest { targetSessionId: B }` and both are within
    **3** units, unpartied trade-eligible THEN B SHALL receive `tradeRequest` message.
    **Test layer: room**
24. **SOC26-24**: WHEN B sends `tradeAccept` THEN both enter `tradeSession` with status
    `open`.
    **Test layer: room**
25. **SOC26-25**: WHEN both sides `tradeOffer` valid stacks + adena then both `tradeConfirm`
    THEN inventories and adena SHALL swap atomically per offers.
    **Test layer: room (two-session)**
26. **SOC26-26**: WHEN A offers more adena than owned THEN `tradeConfirm` SHALL fail with no
    inventory change on either side.
    **Test layer: room**
27. **SOC26-27**: WHEN offer includes quest item or equipped item THEN `tradeOffer` SHALL
    reject.
    **Test layer: unit + room**
28. **SOC26-28**: WHEN either player sends `tradeCancel` or disconnects mid-trade THEN
    trade session SHALL clear with no item movement.
    **Test layer: room**
29. **SOC26-29**: WHEN players move **>3** units apart before confirm THEN `tradeConfirm`
    SHALL reject.
    **Test layer: room**
30. **SOC26-30**: WHEN `wireRoom` has open trade THEN `__GAME_STATE__.trade` SHALL expose
    `{ status, partnerSessionId, myOffer, partnerOffer, myConfirmed, partnerConfirmed }`.
    **Test layer: client unit**

**Independent Test**: Two-session trade 100 adena + item 1835×5 each direction; counts match.

---

### P1: Friend list ⭐ MVP

**User Story**: As a player, I want to add friends and see who is online in my current room.

**Why P1**: ROADMAP deliverable; lightweight persistence.

**Acceptance Criteria**:

31. **SOC26-31**: WHEN player sends `friendAdd { targetSessionId }` and target is in room
    THEN `character_friends` SHALL persist the row and both clients' friend lists SHALL
    include the entry `{ characterId, name, online }`.
    **Test layer: room**
32. **SOC26-32**: WHEN player sends `friendRemove { friendCharacterId }` THEN row SHALL be
    deleted and list updated.
    **Test layer: room**
33. **SOC26-33**: WHEN friend list exceeds **50** entries THEN `friendAdd` SHALL reject.
    **Test layer: unit**
34. **SOC26-34**: WHEN duplicate `friendAdd` for same character THEN SHALL reject (idempotent
    no-op or error — spec: **reject**).
    **Test layer: unit**
35. **SOC26-35**: WHEN friend is connected in same room THEN `online: true`; on leave
    `online: false` for watchers still connected.
    **Test layer: room**
36. **SOC26-36**: WHEN `wireRoom` loads THEN `__GAME_STATE__.friends` SHALL mirror server
    friend list snapshot.
    **Test layer: client unit**

**Independent Test**: Add friend → persists across reconnect in same test DB.

---

### P2: Polish & edge cases

**User Story**: As a player, declined invites and invalid targets fail safely without
corrupting party/trade state.

**Acceptance Criteria**:

37. **SOC26-37**: WHEN target sends `partyDecline` THEN inviter SHALL receive
    `partyDecline` message and no party formed.
    **Test layer: room**
38. **SOC26-38**: WHEN `partyInvite` targets self THEN SHALL reject.
    **Test layer: unit**
39. **SOC26-39**: WHEN `tradeRequest` sent while either party already in trade THEN SHALL
    reject.
    **Test layer: room**
40. **SOC26-40**: WHEN `channel` is unknown THEN `chat` SHALL reject.
    **Test layer: unit**
41. **SOC26-41**: WHEN `friendAdd` targets self `characterId` THEN SHALL reject.
    **Test layer: unit**
42. **SOC26-42**: Full gate `nx run-many -t build lint test` green with **no** new test
    file >**10 s** (AD-014).
    **Test layer: gate**

---

## Edge Cases

- WHEN player disconnects while in party THEN SHALL auto `partyLeave` (same as explicit leave).
- WHEN party leader disconnects THEN leadership transfers before removal processing.
- WHEN trade partner disconnects during `open` THEN cancel trade both sides.
- WHEN chat text contains ASCII control chars (except newline prohibited) THEN strip before broadcast.
- WHEN mob killer not in party but assisters are THEN solo XP path (no party bonus) — party
  requires killer in party for bonus pool.
- WHEN two simultaneous `tradeConfirm` from one side only THEN wait; both required.

---

## Requirement Traceability

| Requirement ID | Story | Status |
| -------------- | ----- | ------ |
| SOC26-01 … 08 | P1: Chat | Pending |
| SOC26-09 … 16 | P1: Party state | Pending |
| SOC26-17 … 22 | P1: Party XP/loot | Pending |
| SOC26-23 … 30 | P1: Trade | Pending |
| SOC26-31 … 36 | P1: Friends | Pending |
| SOC26-37 … 42 | P2: Polish & gate | Pending |

**Coverage:** 42 total, 0 mapped to tasks (pending tasks.md), 0 unmapped.

---

## Success Criteria

- [ ] Two browsers (or two room clients) can party, kill a Gremlin, and both gain **+28** XP.
- [ ] Two clients complete an item+adena trade with server-validated atomic swap.
- [ ] Chat, party, trade, and friends visible in `__GAME_STATE__` via `wireRoom` unit tests.
- [ ] All **42** ACs traced in `validation.md` with unit/room/client evidence.
- [ ] No Playwright in gate.
