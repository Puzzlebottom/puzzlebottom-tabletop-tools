# PRD: Store Layer — Centralised DynamoDB Access

## Problem Statement

DynamoDB schema knowledge is scattered across 10+ Lambda handler, resolver, and step files. Every file that touches the database independently encodes PK/SK key patterns, marshall/unmarshall logic, and its own local TypeScript interface for each item type. Three separate `RollRequestItem` interface definitions have quietly diverged across the codebase.

The `dice-roller` module directly queries the `play-table` DynamoDB table using hardcoded key patterns, creating an invisible cross-module data dependency with no explicit contract. Neither module has a defined boundary for what data access it owns.

The result: changing any item's key structure requires hunting across the entire codebase. Testing any handler requires mocking 3–4 AWS SDK classes. The `INITIATIVE_META` item introduces a non-atomic write pair on every Roll Request creation and an implicit pointer that can fall out of sync with reality.

## Solution

Introduce a colocated store layer for each module — `modules/play-table/store/` and `modules/dice-roller/store/` — each with a narrow public `index.ts` as its interface boundary. The store absorbs all DynamoDB knowledge: key construction, marshalling, GSI access patterns, and pagination. Callers interact only with domain-meaningful methods.

Remove `INITIATIVE_META` entirely and replace it with a sparse GSI (`ACTIVE#<playTableId>`) that directly surfaces the single Active Roll Request per Play Table. Add a second sparse GSI (`ROLLREQUEST#<rollRequestId>`) on Roll items to replace full-partition scans when checking fulfillment.

Introduce a single canonical `RollRequest` type, replacing the three divergent local definitions.

## User Stories

1. As a developer changing a DynamoDB key pattern, I want all key construction to live in one place, so that I only need to change it once.
2. As a developer adding a new handler, I want to call a named store method instead of constructing a `GetItemCommand`, so that I don't need to know the table name, PK/SK format, or marshall syntax.
3. As a developer writing a handler test, I want to mock a single store interface rather than 3–4 AWS SDK classes, so that my test setup is minimal and readable.
4. As a developer reading `player-joined.ts`, I want the handler to contain only business logic, so that I can understand what it does without mentally parsing DynamoDB expressions.
5. As a developer, I want a single canonical `RollRequest` type used everywhere, so that I am not misled by fields that exist in one definition but not another.
6. As a developer working on `dice-roller`, I want read access to `play-table` data via a declared store interface, so that the cross-module dependency is explicit and auditable.
7. As a developer, I want the `ACTIVE#<playTableId>` GSI to tell me whether an Active Roll Request exists, so that I never need to maintain a separate `INITIATIVE_META` pointer item.
8. As a developer, I want Roll items indexed by `rollRequestId` via a sparse GSI, so that checking fulfillment never requires scanning the full Roll partition.
9. As a GM, I want `createRollRequest` to reject my request if an Active Roll Request already exists, so that two overlapping initiatives can never be created.
10. As a GM, I want `clearInitiative` to mark the Roll Request as cleared via `deletedAt`, so that historical initiative data is preserved and queryable.
11. As a Player joining mid-initiative, I want to be added to the Target Players of the Active Roll Request, so that I am expected to roll for the current initiative.
12. As a Player who joins after all other Players have rolled, I want the Roll Request to become unfulfilled again upon my addition, so that the system correctly waits for my roll.
13. As a developer, I want fulfilled state to always be derived from current data rather than stored, so that it is never stale or out of sync.
14. As a developer, I want the `rolls` field removed from the `RollRequest` DynamoDB item, so that the stored representation only contains data that is actually maintained.
15. As a developer adding a new module, I want a clear pattern for colocated stores with explicit public surfaces, so that I know how to structure data access for the new module without guessing.
16. As a developer, I want the boundaries linting config to enforce that cross-module store imports go through public `index.ts` files only, so that internal store implementation details are not leaked.

## Implementation Decisions

### Store structure

Each module gets a colocated store directory with a single public entry point:

- `modules/play-table/store/index.ts` — public interface for Play Table data access
- `modules/dice-roller/store/index.ts` — public interface for Dice Roller data access

Internal implementation files live alongside `index.ts` but are not importable by other modules. The `index.ts` is the deep module boundary.

### Boundaries config

A new `store` element type is added to `eslint-plugin-boundaries` covering `modules/*/store/**`. Resolvers, handlers, and steps are permitted to import from `store`. Cross-module imports are restricted to `modules/play-table/store/index.ts` only — dice-roller code may not import from internal play-table store files.

### GSI changes

**GSI4 — Active Roll Requests (sparse):**

- Attribute: `activePK: ACTIVE#<playTableId>`
- Set on Roll Request creation; removed (via `REMOVE` expression) when `deletedAt` is set by `clearInitiative`
- Sort key: `createdAt`
- Enables `getActiveRollRequest(playTableId)` — always returns 0 or 1 items

**GSI5 — Rolls by Roll Request (sparse):**

- Attribute: `rollRequestPK: ROLLREQUEST#<rollRequestId>`
- Set only on Rolls that belong to a Roll Request (Initiative Rolls); never set on Free Rolls
- Sort key: `createdAt`
- Enables `listRollsForRequest(playTableId, rollRequestId)` — replaces full-partition Roll scans

### INITIATIVE_META removal

The `INITIATIVE_META` DynamoDB item is removed entirely. All handlers and steps that currently read `INITIATIVE_META` are migrated to use `getActiveRollRequest(playTableId)` via GSI4. The write of `INITIATIVE_META` in the Roll Request creation step is also removed.

### Active initiative guard

`createRollRequest` checks for an existing item in GSI4 before starting the Roll Request Pipeline. If an Active Roll Request exists, the mutation throws an error. Only one Active Roll Request of any type may exist per Play Table at a time.

### clearInitiative behaviour change

`clearInitiative` currently deletes `INITIATIVE_META`. After this change it:

1. Queries GSI4 to find the Active Roll Request
2. Sets `deletedAt` on that item
3. Removes `activePK` attribute (removing it from GSI4)

If no Active Roll Request exists, it is a no-op.

### RollRequest canonical type

Three local `RollRequestItem` interface definitions are removed. A single canonical `RollRequest` type is defined in the dice-roller store, sourced from `shared/schemas`. The `rolls` field is excluded — it is never populated in DynamoDB and is a GraphQL resolver concern only. The `rolls: []` write in the Roll Request creation step is removed.

### Fulfillment as derived state

"Fulfilled" is never stored. It is always computed: a Roll Request is fulfilled when every member of `targetPlayerIds` has a corresponding Roll in GSI5. This computation lives inside the store as a helper, callable by handlers without DynamoDB knowledge.

### Store interface methods (dice-roller)

- `getActiveRollRequest(playTableId)` — queries GSI4, returns the Active Roll Request or null
- `getRollRequest(playTableId, rollRequestId)` — fetches a specific Roll Request by ID
- `listRollsForRequest(playTableId, rollRequestId)` — queries GSI5
- `addPlayerToRollRequest(playTableId, rollRequestId, playerId)` — appends to `targetPlayerIds`
- `removePlayerFromActiveRollRequest(playTableId, playerId)` — finds the Active Roll Request via GSI4 and removes the player from `targetPlayerIds`
- `putRollRequest(rollRequest)` — writes a new Roll Request item with `activePK` set
- `putRoll(roll)` — writes a Roll item, setting `rollRequestPK` if `rollRequestId` is present
- `setRollRequestTaskToken(playTableId, rollRequestId, taskToken)` — updates the Task Token field
- `clearRollRequest(playTableId, rollRequestId)` — sets `deletedAt`, removes `activePK`
- `isRollRequestFulfilled(playTableId, rollRequestId)` — derived check via GSI5

### Store interface methods (play-table, read surface used by dice-roller)

- `getPlayTable(playTableId)` — fetches Play Table metadata
- `getPlayer(playTableId, playerId)` — fetches a single Player record

### Lambda instantiation pattern

Stores are instantiated at module scope (outside the handler function) so the `DynamoDBClient` is reused across warm invocations. An optional `DynamoDBClient` parameter is accepted by each store factory for test injection.

## Testing Decisions

**What makes a good test:** Tests should assert on observable outcomes at the store boundary — what items are written, what values are returned, what errors are thrown. Tests should not assert on which DynamoDB commands were called or in what order. Internal implementation choices (e.g. whether to use `PutItem` or `UpdateItem`) are not observable behaviour.

**Store tests:** Each store is tested by injecting a mock `DynamoDBClient` and asserting on the inputs sent to it and the outputs returned. This replaces the current pattern of mocking the AWS SDK module globally.

**Handler tests:** After migration, handler tests mock the store interface (`IDiceRollerStore`, `IPlayTableReadStore`) rather than the AWS SDK. A handler test verifies that the correct store methods are called with the correct arguments, and that the handler responds correctly to different store return values (item found vs null, fulfilled vs unfulfilled).

**Prior art:** Existing handler tests in `modules/dice-roller/handlers/*.test.ts` use `vi.hoisted` with `vi.mock` on `@aws-sdk/client-dynamodb`. The new pattern replaces the SDK mock with a store interface mock — simpler setup, same Vitest tooling.

**GSI behaviour:** The sparse GSI population logic (setting/removing `activePK` and `rollRequestPK`) is tested at the store level by asserting on the marshalled item attributes passed to DynamoDB write commands.

## Out of Scope

- The `taskToken` lifecycle gap: after `SendTaskSuccess` is called, late-joining Players are still added to `targetPlayerIds` but no new pipeline execution is triggered. This is a known issue but requires separate design work.
- Cancellation of Roll Requests by the GM (distinct from `clearInitiative`). The `deletedAt` field supports this pattern but the mutation and handler are not part of this work.
- Pagination of Roll history (`rollHistory` resolver). The existing cursor-based implementation is not changed.
- Frontend changes. No GraphQL schema fields are added or removed.
- Infrastructure CDK changes beyond adding the two new GSI definitions to the DynamoDB table constructs.
- Migration of existing DynamoDB data. `INITIATIVE_META` items in existing tables will become orphaned but are harmless — they are simply never read.

## Further Notes

- The `Roll Request Fulfilled` domain event is the existing `RollRequestCompleted` event renamed. The code-level name change is in scope; updating the EventBridge `detail-type` string is a breaking infrastructure change and is out of scope.
- "Fulfilled" and "cleared" are now the canonical terms for the two distinct end-states of a Roll Request. The codebase currently conflates these under "completed". The store layer is the right place to enforce this distinction — store method names should use `fulfilled` and `cleared`, not `completed`.
- GSI numbering (GSI4, GSI5) assumes the existing table already has GSI1–GSI3 defined. Confirm the actual GSI names during implementation against the CDK table definition.
