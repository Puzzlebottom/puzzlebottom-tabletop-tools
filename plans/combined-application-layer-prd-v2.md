# PRD: Symmetric application layer (play-table + dice-roller)

## Problem Statement

Backend behavior for play-table and dice-roller is structured inconsistently. The dice-roller module already routes most DynamoDB access through a colocated store interface, while the play-table AppSync handler still performs raw DynamoDB and EventBridge calls alongside a separate store that other modules use. The same play-table table is therefore described in two implementation paths, which risks drift — for example, invite-code normalization currently lives inline in the resolver, not the store, so adding a new code path could silently skip the `.toUpperCase()` call.

Dice-roller resolvers contain orchestration logic (`createRollRequestWithDeps`, `createRollWithDeps`) that is not yet extracted into a named application layer. There is no symmetric folder structure across both modules, so a developer cannot apply one mental model when navigating either.

The play-table store's `Player` type is also inconsistent with the generated GraphQL types: it lacks `playTableId` and `deletedAt`, which forces the resolver to manually assemble composite responses.

## Solution

Introduce a **symmetric three-tier pattern** in both modules: a **Resolver** (thin AppSync routing and identity extraction), an **Application layer** (use-case orchestration behind injectable ports), and a **Store layer** (DynamoDB-only boundary). Both layers are named and structured identically across modules.

Play-table's Application layer owns `createPlayTable`, `joinPlayTable`, `leavePlayTable`, `getPlayTable`, and `getPlayTableByInviteCode` — workflows that today live directly in the resolver. Dice-roller's Application layer extracts the existing `WithDeps` orchestration functions into the same symmetric shape.

Invite-code normalization moves into the Store layer. The play-table store types are updated to align with the generated GraphQL types. Application methods return generated GraphQL types directly. Outbound side effects (EventBridge, Step Functions) are encapsulated behind typed injectable ports.

End users should see no intentional change to GraphQL behavior.

## User Stories

1. As a developer working on play-table, I want all DynamoDB access for play-table data to go through the play-table store, so that I never maintain two different key or query implementations for the same table.
2. As a developer working on play-table, I want invite-code normalization defined in exactly one place inside the store, so that lookups by invite code cannot disagree between any code path.
3. As a developer working on play-table, I want EventBridge publication encapsulated behind a typed event port with one method per domain event, so that application tests mock a small, meaningful interface rather than the full AWS SDK.
4. As a developer working on dice-roller, I want resolver entrypoints to delegate to an application layer, so that the resolver file reads as routing and auth extraction only.
5. As a developer working on dice-roller, I want Step Functions starts encapsulated behind a typed workflow port with one method per pipeline, so that application tests mock a small, meaningful interface rather than the full SFN client.
6. As a developer working on dice-roller, I want the same `resolvers / application / store` folder pattern as play-table, so that I can navigate either module without relearning the structure.
7. As a developer on either module, I want use-case logic tested with mocked stores and mocked ports, so that tests assert behavior rather than AWS command trivia.
8. As a developer adding a new AppSync mutation in play-table, I want a clear place to implement orchestration separate from GraphQL wiring, so that I do not accidentally duplicate persistence code.
9. As a developer adding a new dice-roller mutation, I want the same separation, so that Step Function ARNs and store calls are not scattered across resolver files.
10. As a maintainer, I want dice-roller to depend only on the public play-table store interface, so that cross-module coupling stays auditable.
11. As a developer debugging a production issue, I want side effects initiated from one layer per module, so that I can trace what ran without following duplicate code paths.
12. As a GM creating a play table, I want create/join/leave behavior to remain correct and stable, so that my table and players stay consistent.
13. As a player joining with an invite code, I want casing handled consistently regardless of which code path runs, so that I am not rejected due to normalization bugs.
14. As a GM running initiative or rolls, I want existing roll and initiative flows to behave as today, so that sessions are not disrupted by the refactor.
15. As a developer writing tests for play-table, I want application-level tests that mock the store and event port, so that setup is smaller and failures are easier to interpret.
16. As a developer writing tests for dice-roller, I want resolver tests focused on routing and application tests covering orchestration, so that the test pyramid matches the new boundaries.
17. As a developer onboarding to the repo, I want both modules to follow the same three-tier pattern, so that I can copy it for new modules without reverse-engineering two different styles.
18. As a security-conscious developer, I want authorization and identity extraction to remain at the Resolver edge, so that the Application layer receives already-scoped inputs.
19. As a developer evolving the store layer, I want application code to consume store methods only, so that GSI or key changes stay confined to the store implementation.
20. As a CI maintainer, I want eslint boundaries to continue restricting cross-module imports to public store entrypoints, so that the Application layer does not become a backdoor for deep imports.
21. As a developer reading the play-table store, I want `Player` to include `playTableId` and `deletedAt` fields aligned with the generated GraphQL types, so that I never need to manually attach these fields in a higher layer.
22. As a developer writing invite-code generation tests, I want to inject a deterministic code generator via the application factory, so that tests do not need to mock `Math.random`.

## Implementation Decisions

### Directory naming

Both modules use `application/` as the directory name for the use-case orchestration layer. This is the canonical term from the DDD / Clean Architecture vocabulary and is applied identically in both modules.

### Play-table store updates (prerequisite)

Before the Application layer is introduced, the play-table store is updated:

- `Player` gains `playTableId: string` persisted as an explicit attribute (not derived from PK). This aligns with how dice-roller models its entities.
- `Player` gains `deletedAt: string | null` aligned with the generated GraphQL type. The field is always `null`; the store never writes it (see below).
- `PlayTable` gains `deletedAt: string | null` aligned with the generated GraphQL type. Always `null`; never written.
- `deletePlayer` remains a **hard delete** (`DeleteItemCommand`). Soft delete is not implemented — it would require stable player identity across sessions, which is out of scope.
- `listPlayers` does not filter by `deletedAt` — the field is never set, so filtering is dead code.
- `getPlayTableByInviteCode` normalizes its input with `.toUpperCase()` before constructing the GSI key.
- `putPlayTable` normalizes `inviteCode` with `.toUpperCase()` before constructing `GSI2PK`.

### Application layer: public interface

Each module's `application/index.ts` exports:

- A factory function: `createPlayTableApplication(deps)` / `createDiceRollerApplication(deps)`
- An interface: `IPlayTableApplication` / `IDiceRollerApplication`

Application methods map 1:1 to GraphQL mutations and queries. Application methods return generated GraphQL types from `@puzzlebottom-tabletop-tools/graphql-types` directly. Store types remain narrower domain types; the Application layer maps between them.

### Play-table application responsibilities

- `createPlayTable(gmUserId)`: generates a unique invite code (retry loop up to 5 times using `store.getPlayTableByInviteCode`), writes via `store.putPlayTable`, returns `PlayTable`.
- `joinPlayTable(inviteCode, input)`: resolves table via `store.getPlayTableByInviteCode`, writes player via `store.putPlayer`, publishes `PlayerJoined` via event port, returns `PlayTable` with `players`.
- `leavePlayTable(playTableId, playerId)`: deletes player via `store.deletePlayer`, publishes `PlayerLeft` via event port, returns `true`.
- `getPlayTable(playTableId)`: fetches table and players, returns `PlayTable` with `players` (the **Play Table View**).
- `getPlayTableByInviteCode(inviteCode)`: resolves table via store, fetches players, returns `PlayTable` with `players` or `null`.

### Invite-code generation

`generateInviteCode` lives as a private default in the Application layer. The factory accepts an optional override:

```
createPlayTableApplication({ store, events, generateInviteCode? })
```

The override is used in tests to supply deterministic codes without mocking `Math.random`.

### Event port

```
interface IPlayTableEventPort {
  publishPlayerJoined(detail: PlayerJoinedDetail): Promise<void>
  publishPlayerLeft(detail: PlayerLeftDetail): Promise<void>
}
```

One method per domain event. The Application layer never imports EventBridge client types directly.

### Workflow port (dice-roller)

```
interface IDiceRollerWorkflowPort {
  startRollRequestPipeline(input: RollRequestStepPayload): Promise<void>
  startRollPipeline(input: RollPipelineStepPayload): Promise<void>
}
```

One method per pipeline. The Application layer never imports SFN client types directly.

### Dice-roller application responsibilities

- Extract existing `createRollRequestWithDeps`, `createRollWithDeps`, and related orchestration from resolver files into `application/index.ts`.
- Drop the `WithDeps` naming convention — methods are named after their use case.
- Coordinator stores (play-table store + dice-roller store) and workflow port are injected via `createDiceRollerApplication(deps)`.
- `clearInitiative` and `rollHistory` also move to the Application layer.

### Composition root

Both modules use a lazy-init pattern per Lambda bundle:

```
let _app: IPlayTableApplication | undefined
function getApp(): IPlayTableApplication {
  _app ??= createPlayTableApplication({ store, events })
  return _app
}
```

This matches the existing dice-roller `getRollRequestResolverDeps()` pattern and handles Lambda cold-start caching correctly.

### Resolver shape after migration

- Resolvers extract Cognito identity and GraphQL arguments, call `getApp().methodName(...)`, and return the result.
- Resolver tests cover routing only (correct method called for each field name) and non-trivial identity extraction.
- All behavior tests move to the Application layer.

### Cross-module boundaries

- Dice-roller continues to consume only the public play-table store interface. It does not import play-table Application code.
- Play-table does not import dice-roller.

### Sequencing

Three issues in dependency order:

1. **Play-table store updates** — `Player` and `PlayTable` type alignment, invite-code normalization in store.
2. **Play-table Application layer + resolver migration** — Application layer with event port and injectable code generator; resolver becomes thin routing; existing resolver behavior tests replaced by Application tests.
3. **Dice-roller Application layer + resolver migration** — Extract `WithDeps` into `application/`; add workflow port; resolver becomes thin routing; existing resolver behavior tests replaced by Application tests.

## Testing Decisions

### What makes a good test

- Assert on **observable outcomes**: return values, thrown errors, and calls to injected ports (store methods, event port, workflow port) with meaningful arguments.
- Do not assert on which low-level Dynamo command is used — that is the store's concern.
- Application tests must survive internal refactors that change method order inside a use case, as long as behavior is preserved.

### Modules to test

- **Play-table store**: extend existing store tests to cover `playTableId` on `Player`, invite-code normalization in `getPlayTableByInviteCode` and `putPlayTable`, and `deletedAt` presence on returned types.
- **Play-table Application**: `createPlayTable` (including uniqueness retry and failure), `joinPlayTable` (including invalid invite code), `leavePlayTable`, `getPlayTable`, `getPlayTableByInviteCode`. Use a fake store and fake event port. Include authorization cases (missing `gmUserId`).
- **Dice-roller Application**: `createRollRequest`, `createRoll`, `clearInitiative`, `rollHistory`. Use fake dice-roller store, fake play-table store, and fake workflow port.
- **Resolvers (both modules)**: routing only — one test per field name asserting the correct Application method is called.
- **Stores**: continue existing patterns.

### Prior art

- Play-table store tests (`play-table-store.test.ts`) — inject mock DynamoDB client, assert on command inputs.
- Dice-roller resolver tests (`roll-request.test.ts`) — `vi.hoisted` pattern, module-level mock setup.
- Dice-roller store tests (`dice-roller-store.test.ts`) — `makeClient()` helper, per-describe mock responses.

## Out of Scope

- Redesigning the Step Functions pipeline graph, handler signatures, or subscription delivery model.
- Frontend changes and new GraphQL fields.
- Replacing EventBridge with another bus or adding a transactional outbox.
- Broad CDK refactors beyond what is needed for new entry files.
- Unifying play-table and dice-roller into a single deployable artifact.
- Performance optimization passes.
- Migrating non-AppSync step Lambda entrypoints to the Application layer (may follow in a future PRD).
- Soft-delete for players or play tables — requires stable player identity across sessions, which is a separate design problem.
- Player reconnect continuity (regaining roll history after disconnect) — requires stable player identity, separate issue.
- Table deletion.

## Further Notes

- **Alignment goal:** A developer opening either module should recognize `resolver → application → store` without consulting a diagram.
- `deletedAt` fields on `PlayTable` and `Player` are forward-compatible placeholders. They are always `null` until soft-delete is explicitly designed and implemented.
- The `WithDeps` naming convention in dice-roller resolvers is a proto-application-layer — this PRD formalizes it into a proper directory and drops the suffix.
