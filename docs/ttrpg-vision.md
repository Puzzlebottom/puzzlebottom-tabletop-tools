# Puzzlebottom's Tabletop Tools Suite — Vision & Open Questions

This document captures the product vision, open questions, and prioritization for development. Update as decisions are made.

---

## Confirmed Vision (Summary)

| Aspect               | Long-term                                                                            | MVP                                               |
| -------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **Project name**     | Puzzlebottom's Tabletop Tools Suite                                                  | —                                                 |
| **First tool**       | Dice roller                                                                          | —                                                 |
| **Player interface** | Cross-platform: web + iOS + Android                                                  | Web only                                          |
| **Dice animation**   | 3D animated; simple at first, fancier later                                          | Low-poly 3D, basic lighting, no sound             |
| **Roll types**       | Ad hoc (player + GM) + GM-assigned (skill checks, saves, initiative, etc.)           | Ad hoc (player + GM); GM-assigned initiative only |
| **GM controls**      | Assign rolls to any/all players; set DC, advantage, modifiers; toggle private/public | Same                                              |
| **Visibility**       | Public by default; GM can make private                                               | Same                                              |
| **Ruleset**          | 5e D&D first; extensible for other rulesets                                          | None                                              |
| **Architecture**     | Modular—additional tools added with focus on modularization                          | —                                                 |

---

## Open Questions

Questions to resolve during development. Full list in the plan. Add your answers here as you decide.

---

## Decisions

### PlayTable Membership & Join Flow

1. GM creates a PlayTable and invite link. GM is the only person required to sign in.
2. Players use the link to join the PlayTable. On join, they are prompted for:
   - Character name
   - Initiative modifier

### PlayTable Model

- **Long term:** Support both campaigns and one-shots.
- **MVP:** PlayTable stands alone. No Campaign entity. Keep structure minimal.
- **Scaffolding:** Design so Campaign can be added later (e.g. optional `campaignId` on PlayTable, or Campaign references PlayTables) without breaking migrations. Only add complexity now if it helps that future extension.

### Session vs Campaign

- Sessions can be standalone or part of a campaign. Both are supported long term.
- **MVP:** All sessions are standalone (no Campaign). When Campaign is added, Session gets optional `campaignId`.

### GM Designation

- GM owns the PlayTable (and campaign, when that exists). One GM per PlayTable.
- GM is stable; players join and leave. GM role transfer deferred.
- **MVP:** GM does not appear in initiative order. GM and Player are separate.
- **Later:** GM will control enemy/NPC entities and encounter events; GM (or their controlled entities) will occupy initiative order.

### GM-Assigned Roll Flow

- GM pushes roll requests to player devices in real time (AppSync subscriptions). No polling.

### Tool Composition

- Unified app. Tools (dice roller, character sheet, etc.) as sections/routes within one deploy. Shared auth, shared data, single URL.

### Tool Dependencies

- **MVP:** Dice roller works without campaigns or full character entities (Option B). PlayTable + Players (name, initiative modifier) sufficient.
- **Eventually:** Rolls will depend on campaigns/characters (Option A). Design so rolls can optionally link to character later without breaking MVP data.

### Initiative Tie-Breaking

- Sort by: d20 result (desc), then initiative modifier (desc).
- If both roll and modifier tie: players occupy the same initiative slot, randomly ordered among themselves.

### Initiative Re-Rolls

- GM can clear and re-roll initiative.

### Private Rolls

- **GM-initiated roll (ad hoc):** When GM marks it private, only GM sees the result. No players see it.
- **GM-assigned roll (player rolls):** When GM marks it private, only GM and the target player see the result. Other players do not.
- **Private roll UX:** Other players see nothing at all — no "a roll happened" or obscured placeholder.

### Result Broadcast Timing

- Roller sees their result at the same moment as everyone else. Like a live roll at a physical table — no early peek.
- **Result is determined and persisted before reveal.** Server: RNG → write to DynamoDB → then publish to subscription. No client sees the result until after persist.
- **All receive via subscription.** The mutation does NOT return the result for display; it returns only `rollId` or `accepted`. The actual result is delivered only via the AppSync subscription. Clients (including the roller) wait for the subscription payload before displaying. So everyone gets it at the same time.

### Subscription (AppSync)

- **What it is:** AppSync subscriptions are real-time push. Clients subscribe to a channel (e.g. `onRollCompleted(playTableId)`). When the server publishes a payload (triggered by the mutation completing), AppSync pushes it to all subscribed clients.
- **Reveal order:** Server completes RNG + persist, then publishes. All subscribers receive the payload at roughly the same time (network latency varies, but no one gets it before persist). The mutation response returns before the subscription fires, so clients must ignore the mutation for display and only render when the subscription arrives.

### Animation Duration

- Minimum duration so fast server responses don't feel abrupt. Add some variance so it doesn't feel mechanical.

### Roll-in-Progress

- **Per player/GM:** One ad hoc roll in progress at a time. Block another roll from that person until the current one completes.
- **Across players:** Multiple players (and the GM) can be rolling at the same time.
- **GM-assigned:** GM can have multiple roll requests pending from players at once (e.g. initiative = all players have a pending request).

### GM-Assigned + Player-Initiated Conflict

- GM-assigned roll request goes to **pending** until the player initiates the roll. If player is mid-roll, request waits.
- Players can have multiple pending requests.
- GM can: issue multiple requests, cancel pending requests, or delete rolls after they've been made.

### RollRequest Type & Initiative Ordering

- **RollRequest has a type.** e.g. `initiative`, `skill_check`, etc. MVP implements `initiative` only; build so other types can be added later.
- **Results handled the same** — regardless of type, the roll flow (RNG, persist, reveal) is identical.
- **Initiative ordering:** Not computed in the mutation/subscription flow. A consumer (e.g. Lambda) reacts to the `RollCompleted` EventBridge event; when it detects an initiative roll, it computes the ordered list and stores/updates it. Clients display the ordered initiative list from a separate query or subscription. Keeps the roll flow generic; initiative-specific logic lives in the event consumer.

### 3D Engine

- Three.js (with react-three-fiber).

### 3D Dice — Simple vs Fancy

- **Simple (MVP):** Low-poly 3D with basic lighting and animation.
- **Fancy (later):** Physics, materials, sound. On mobile: shake device to roll with haptic feedback.

### Roll History

- **MVP:** Per-PlayTable history. Searchable log of rolls. No export.
- **Pagination:** Infinite scroll with paginated fetch-more (load more as user scrolls).

### Rate Limiting

- None. Only limit is the one-roll-in-progress-per-player rule.

### Reduced Motion

- No reduced-motion mode for MVP. Deferred.

### Sound

- Dice sounds on roll/land. Toggleable (on/off). **Deferred** — not in MVP.

### Roll Assignment Visibility (Targeted GM-Assigned)

- GM's choice. If GM makes it private: only the target player sees the assignment (and only player + GM see the result). If public: all see assignment and result.

### Offline Player Assignment

- No support. Assignment is for online players only. Deferred.

### Connection Loss Mid-Roll

- Roll result is persisted in DB. If server completed the roll before disconnect, the result exists. On reconnect, player fetches PlayTable roll history and sees their result. Server is source of truth.

### DynamoDB Design (MVP)

- **Structure:** GM has a PlayTable → players → rolls.
- **PlayTable = session (MVP):** For MVP, PlayTable is effectively the session. No separate Session entity. (Avoid "session" as entity name to prevent confusion with user/browser sessions.)
- **Visibility:** Player sees log of their own rolls. GM sees log of all rolls in the PlayTable.
- **Access patterns:** Rolls by player; rolls by PlayTable (all). Single DynamoDB table with GSIs to support both. Detail when implementing.

### Player Identity (Rejoin)

- Support player rejoin. Player identified by cookie or session key stored in local storage (localStorage). On join, client receives a key; stores it locally. On rejoin (same browser/device), key is read and player is recognized as the same. No sign-in required.

---

## Dice Roll Flow (Option A)

This flow defines how roll requests, server-side RNG, animation, persistence, and downstream reactions work together.

### Principles

- **AppSync for live** — Roll requests, results, and multi-user synced display use AppSync (mutations + subscriptions).
- **EventBridge for reactions** — After a roll is successfully persisted, an event is dispatched so other services can react (analytics, exports, future tools).
- **Server-side RNG** — Roll results are always determined on the server. Client never generates the outcome.
- **Animation masks latency** — Animation starts when the client sends the request and runs until the server result arrives. Network/DB latency is hidden behind the dice tumble.
- **Cocked die = error state** — If the server fails (timeout, error), the animation completes as a "cocked die" (ambiguous result, re-roll required). This maps the real-world concept to a clear error UX.

### Flow (Step by Step)

1. **Client sends roll request**  
   Player (or GM assigning to player) triggers a roll. Client calls `rollDice` mutation with roll params (dice type, modifiers, playTableId, etc.).

2. **Animation starts immediately**  
   As soon as the mutation is sent, the 3D dice animation begins (tumbling, physics). The client does not know the result yet.

3. **Server: resolve roll**  
   AppSync invokes the `rollDice` resolver (Lambda):
   - Validate request (playTableId, permissions, params)
   - Generate roll result via server-side RNG
   - Write roll record to DynamoDB
   - Publish result to AppSync subscription (only after persist — no client sees result before this)
   - Dispatch `RollCompleted` event to EventBridge (for downstream consumers)
   - Return `rollId` or `accepted` to the requesting client (no result in mutation response)

4. **Client receives result**  
   Subscription payload arrives with the actual dice values. All clients (including the roller) receive via subscription. Animation completes: dice settle on the correct faces.

5. **On failure**  
   If the resolver fails, times out, or returns an error: the client never receives a valid result. The animation completes as a **cocked die** — dice land in an ambiguous orientation (e.g. on edge, tilted). UI indicates "ambiguous result, please re-roll." No result is persisted; no EventBridge event is sent.

### EventBridge Post-Roll Event

After a successful roll:

- **Event:** `source: puzzlebottom-tabletop-tools`, `detailType: RollCompleted`
- **Detail:** Roll id, playTableId, result, metadata, rollRequestType (e.g. `initiative`)
- **Consumers:** Analytics, roll history aggregation, **initiative ordering** (when type is `initiative`, compute order and store/update), future tools. Real-time display: AppSync subscription. Initiative order: EventBridge consumer.

### Summary Diagram

```
Client                    AppSync/Lambda              EventBridge
  |                              |                          |
  |-- rollDice mutation -------->|                          |
  |   (animation starts)         |                          |
  |                              |-- RNG                    |
  |                              |-- DynamoDB write         |
  |                              |-- subscription publish   |
  |<-- result -------------------|                          |
  |   (animation lands)          |-- PutEvents ------------->|
  |                              |   (RollCompleted)         |
  |                              |                          |
  |   On error: animation -> cocked die, no event            |
```

---

## Question Prioritization

### Must Answer Before Dice Roller MVP

See plan for full question list. Prioritize questions that affect API design, roll flow, and animation behavior.

### Can Be Deferred to Phase 2

- Mobile framework choice (decide when starting mobile)
- Offline support
- Full dice notation
- Character linking
- Roll history export/search
- Dice customization
- GM role transfer
- Join request flow

---

## Dice Roller MVP Scope (Proposed)

Minimal feature set to unblock implementation. Refine as you answer questions.

| Feature        | In scope                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Platform**   | Web only                                                                                                                                   |
| **Roll types** | Ad hoc (player-initiated); ad hoc (GM-initiated); GM-assigned initiative only                                                              |
| **Initiative** | Single GM action: "Call for initiative" → all players requested to roll d20. Results displayed in descending order for all players and GM. |
| **Dice**       | d20 only                                                                                                                                   |
| **Modifiers**  | Advantage, disadvantage, DC — assigned by GM                                                                                               |
| **Visibility** | Public by default; GM can make private                                                                                                     |
| **Entities**   | User (GM), PlayTable, Player (name + initiative modifier; no sign-in), Roll, RollRequest                                                   |
| **3D**         | Basic 3D dice (Three.js)                                                                                                                   |
| **Ruleset**    | None — no ruleset required at MVP                                                                                                          |

**Out of scope for MVP:** Other dice (2d6, 4d6, etc.), full dice notation, 5e presets (skills/saves/attacks), full character entities, player sign-in, offline, mobile, campaign metadata, roll history export, sound.

---

## Suggested Next Steps

1. **Answer questions** — Work through the plan; add your decisions to this doc as you go.
2. **Create domain entities** — Add `PlayTable`, `Player`, `Roll`, `RollRequest` to `shared/schemas` (or new `shared/domain`).
3. **Extend GraphQL schema** — Add dice roller types, mutations, subscriptions.
4. **Implement dice roller UI** — Route `/dice`, roll form, 3D dice component.
5. **Implement backend** — Resolvers for create roll, assign roll, subscribe to rolls.
