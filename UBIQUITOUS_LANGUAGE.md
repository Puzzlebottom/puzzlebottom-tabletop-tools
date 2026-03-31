# Ubiquitous Language

## Actors

| Term                 | Definition                                                                            | Aliases to avoid         |
| -------------------- | ------------------------------------------------------------------------------------- | ------------------------ |
| **Player**           | A human participant at a Play Table, associated with a Player Character               | User, participant        |
| **GM (Game Master)** | A Player with elevated permissions who controls the table and can issue Roll Requests | Dungeon Master, DM, host |
| **Player Character** | The fictional character a Player controls at a Play Table                             | Character, PC            |

## Table lifecycle

| Term            | Definition                                                          | Aliases to avoid           |
| --------------- | ------------------------------------------------------------------- | -------------------------- |
| **Play Table**  | An active game session that Players join and leave                  | Game, session, room, table |
| **Invite Code** | A shareable code that allows a Player to join a specific Play Table | Join code, room code       |

## Dice rolling

| Term                        | Definition                                                                  | Aliases to avoid             |
| --------------------------- | --------------------------------------------------------------------------- | ---------------------------- |
| **Roll**                    | A single completed dice roll result, owned by a Player at a Play Table      | Dice roll, throw             |
| **Free Roll**               | A Roll not associated with any Roll Request                                 | Ad hoc roll, standalone roll |
| **Initiative Roll**         | A Roll associated with an Initiative Roll Request                           | Initiative dice, turn roll   |
| **Roll Request**            | A GM-issued instruction for one or more Target Players to roll dice         | Roll prompt, roll command    |
| **Initiative Roll Request** | A Roll Request of type `initiative`, used to determine turn order in combat | Initiative, initiative order |
| **Target Players**          | The Players listed on a Roll Request who are expected to submit a Roll      | Required players, rollers    |
| **Roll Notation**           | A string describing the dice to roll (e.g. `2d6+3`)                         | Dice expression, dice string |
| **Modifier**                | A fixed integer added to a Roll's total                                     | Bonus, adjustment            |
| **Roll Result**             | The final numeric outcome of a Roll after applying the Modifier             | Total, result                |
| **Roll Type**               | The category of a Roll Request — currently only `initiative`                | Roll kind, roll category     |
| **DC (Difficulty Class)**   | An optional target number attached to a Roll Request                        | Target number, difficulty    |
| **Private Roll**            | A Roll visible only to the GM                                               | Hidden roll, secret roll     |

## Roll Request lifecycle

| Term                       | Definition                                                                                                          | Aliases to avoid                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Active Roll Request**    | A Roll Request that has not been cleared — accepts new Target Players and new Rolls regardless of fulfillment state | Open request, pending request                               |
| **Fulfilled Roll Request** | A Roll Request where every current Target Player has submitted a Roll — a derived, transient state, never stored    | Completed request, finished request                         |
| **Cleared Initiative**     | An Initiative Roll Request whose `deletedAt` has been set by the GM via `clearInitiative` — permanently inactive    | Completed initiative, finished initiative, ended initiative |

## Events

| Term                       | Definition                                                                                 | Aliases to avoid                          |
| -------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| **Domain Event**           | A fact that has occurred in the system, published to EventBridge with a `detail-type`      | Message, notification                     |
| **Event Detail**           | The typed payload of a Domain Event                                                        | Event body, event data                    |
| **Event Detail Type**      | The discriminant string that identifies which Domain Event occurred                        | Event name, event type                    |
| **Roll Completed**         | Domain Event published when a Roll has been generated and stored                           | Roll done, roll finished                  |
| **Roll Request Fulfilled** | Domain Event published when all current Target Players have submitted a Roll for a request | Roll request completed, roll request done |
| **Player Joined**          | Domain Event published when a Player joins a Play Table                                    | Player added                              |
| **Player Left**            | Domain Event published when a Player leaves a Play Table                                   | Player removed                            |
| **Initiative Updated**     | Domain Event published when the initiative roll state changes at a Play Table              | Initiative changed                        |

## Step Function workflows

| Term                      | Definition                                                                               | Aliases to avoid                          |
| ------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Roll Pipeline**         | The Step Function workflow that generates, stores, and publishes a completed Roll        | Roll workflow, roll state machine         |
| **Roll Request Pipeline** | The Step Function workflow that persists a Roll Request and waits for it to be fulfilled | Roll request workflow                     |
| **Step Contract**         | The shared Zod schema defining the input and output types for a step in a pipeline       | Step payload, step interface, step schema |
| **Task Token**            | A Step Functions handle used to pause a pipeline and resume it from an external caller   | Wait token, callback token                |

## Architecture layers

| Term                  | Definition                                                                                                 | Aliases to avoid                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Resolver**          | The thin AppSync routing layer that extracts identity, delegates to the Application layer, and maps errors | Handler, controller                           |
| **Application layer** | The use-case orchestration layer that composes Store reads/writes and outbound ports                       | Service layer, use-case layer, business logic |
| **Store layer**       | The DynamoDB-only access layer that owns all key and query patterns for a module                           | Repository, data layer, DAO                   |
| **Event port**        | An injectable interface that abstracts EventBridge publication behind typed domain-event methods           | Event publisher, event bus client             |
| **Workflow port**     | An injectable interface that abstracts Step Functions execution behind typed pipeline-start methods        | SFN client, state machine port                |
| **Composition root**  | The module-level lazy-init function that wires stores, ports, and application instances together           | Bootstrap, dependency wiring, factory root    |
| **Play Table View**   | The composite read model returned by the Application layer combining a Play Table and its Players          | Play table with players, enriched play table  |

## Schemas and types

| Term                 | Definition                                                                                 | Aliases to avoid                  |
| -------------------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| **GraphQL Schema**   | The composed GraphQL type definitions that define the AppSync public API surface           | API schema                        |
| **Events Schema**    | The composed GraphQL definitions for Domain Event payloads, separate from the API surface  | Event types                       |
| **Zod Schema**       | A runtime validator that is also the source of truth for a TypeScript type                 | Validation schema, runtime schema |
| **Generated Types**  | TypeScript types and Zod schemas produced by the codegen pipeline from GraphQL definitions | Auto-generated types              |
| **Codegen Pipeline** | The script sequence that composes module GraphQL files and runs graphql-codegen            | Code generation, codegen          |

## Relationships

- A **Play Table** has one **GM** and zero or more **Players**
- A **Player** controls exactly one **Player Character** at a given **Play Table**
- A **Roll Request** targets one or more **Target Players** and has a **Roll Notation** and optional **DC**
- A **Roll** belongs to one **Player** at one **Play Table** and may be linked to a **Roll Request**
- A **Play Table** has at most one **Active Roll Request** of type `initiative` at any time
- A **Fulfilled Roll Request** is a transient derived state of an **Active Roll Request** — adding a new **Target Player** immediately unfulfills it
- A **Cleared Initiative** is permanent — a **Play Table** must have no **Active Roll Request** before a new **Initiative Roll Request** can be created
- A **Roll Pipeline** is triggered for each **Roll** and produces a **Roll Completed** event
- A **Roll Request Pipeline** is triggered for each **Roll Request** and waits via **Task Token** until the request is **fulfilled**

## Example dialogue

> **Dev:** "When the GM calls `clearInitiative`, is the Roll Request fulfilled at that point?"

> **Domain expert:** "Not necessarily — **cleared** and **fulfilled** are different things. **Fulfilled** means every current **Target Player** has submitted a **Roll**. **Cleared** means the GM has ended the **initiative** entirely by setting `deletedAt`. A request can be cleared without ever being fulfilled."

> **Dev:** "And if a new Player joins mid-initiative, does the Roll Request become unfulfilled again?"

> **Domain expert:** "Exactly. The Player gets added to **Target Players**, which makes the request unfulfilled again — even if all the original targets had already rolled. The request is still **active** the whole time."

> **Dev:** "So 'active' and 'fulfilled' are independent?"

> **Domain expert:** "Yes. **Active** just means the GM hasn't cleared it. **Fulfilled** is a snapshot: right now, does every **Target Player** have a **Roll**? It can flip back and forth as Players join and leave. Only `clearInitiative` can make a request permanently inactive."

> **Dev:** "What fires the `Roll Request Fulfilled` event then?"

> **Domain expert:** "That fires the moment the last required **Roll** comes in and the request tips into **fulfilled** — it signals the **Roll Request Pipeline** to continue. But the initiative itself stays **active** until the GM decides to clear it."

## Example dialogue (architecture)

> **Dev:** "Where does invite-code normalization live — the Resolver, Application layer, or Store?"

> **Domain expert:** "The **Store layer**. The **Store layer** owns all key patterns, and `INVITECODE#` is a GSI key. Normalization belongs next to the key construction, not scattered across callers."

> **Dev:** "So the **Application layer** just passes the raw user-supplied code?"

> **Domain expert:** "Exactly. The **Application layer** calls `store.getPlayTableByInviteCode(rawCode)` and trusts the **Store** to normalize. No `.toUpperCase()` in the **Application layer**."

> **Dev:** "What if I need to publish a **Player Joined** event — does that go through the **Event port**?"

> **Domain expert:** "Yes. The **Application layer** calls `events.publishPlayerJoined(detail)` on the **Event port**. The **Resolver** never touches EventBridge directly, and neither does the **Store**."

## Flagged ambiguities

- **"Completed"** is critically ambiguous: used in the codebase to mean both **Fulfilled** (all Target Players have rolled) and **Cleared** (GM has ended the initiative). These are distinct lifecycle states. Use **fulfilled** for the derived rolling state and **cleared** for the GM-terminated state. The existing event name `RollRequestCompleted` should be understood as **Roll Request Fulfilled**.
- **"Active"** has two colloquial meanings: (1) the Roll Request lifecycle state (not cleared, `deletedAt` is null) and (2) an active Step Function execution. Always qualify: **Active Roll Request** for the lifecycle state, **running execution** for Step Functions.
- **"Initiative"** is overloaded: used loosely to mean the concept (turn-order rolling), the Roll Type value (`'initiative'`), and the active **Initiative Roll Request** entity. In domain discussion, prefer **Initiative Roll Request** for the data entity and **initiative** (lowercase) for the concept.
- **"Event"** is overloaded: used for both **Domain Events** (EventBridge, async) and GraphQL subscription events (AppSync, real-time push). Prefer **Domain Event** for EventBridge and **Subscription** for AppSync push.
- **"Schema"** is overloaded: used for GraphQL schema definitions, Zod runtime validators, and database key schemas. Qualify with **GraphQL Schema**, **Zod Schema**, or **key schema** as appropriate.
- **"Module"** is overloaded: used for both npm workspace packages (`shared/schemas`) and game domain modules (`dice-roller`, `play-table`). Prefer **package** for npm workspaces and **module** only for domain boundaries.
- **"Payload"** is used for both Step Contract inputs and Domain Event details. Prefer **Step Contract** for step function I/O and **Event Detail** for EventBridge payloads.
- **"Type"** is heavily overloaded (TypeScript type, GraphQL type, Roll Type, Event Detail Type). Always qualify: **Roll Type**, **Event Detail Type**, **TypeScript type**, **GraphQL type**.
- **"Session"** is used colloquially for both a game session (a **Play Table**) and a player's network connection session. Prefer **Play Table** for the domain entity; "session" should only appear in authentication or connection contexts.
- **"Service"** is used in some ecosystems for the **Application layer**. Avoid it here — it's overloaded between AWS services, npm packages, and business logic. Use **Application layer** for the orchestration tier.
- **"Ad hoc"** appears in the codebase as a `rollRequestType` value (`'ad_hoc'`) but the domain term is **Free Roll**. In domain discussion use **Free Roll**; `'ad_hoc'` is a schema implementation detail.
