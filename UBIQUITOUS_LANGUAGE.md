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

| Term                      | Definition                                                                                   | Aliases to avoid             |
| ------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------- |
| **Roll**                  | A single completed dice roll result, owned by a Player at a Play Table                       | Dice roll, throw             |
| **Roll Request**          | A GM-issued instruction for one or more Players to roll dice, with a specified Roll Notation | Roll prompt, roll command    |
| **Roll Notation**         | A string describing the dice to roll (e.g. `2d6+3`)                                          | Dice expression, dice string |
| **Modifier**              | A fixed integer added to a Roll's total                                                      | Bonus, adjustment            |
| **Roll Result**           | The final numeric outcome of a Roll after applying the Modifier                              | Total, result                |
| **Roll Type**             | The category of a Roll — currently `initiative` or `ad_hoc`                                  | Roll kind, roll category     |
| **DC (Difficulty Class)** | An optional target number attached to a Roll Request                                         | Target number, difficulty    |
| **Initiative**            | A Roll Type used to determine turn order in combat                                           | Turn order roll              |
| **Private Roll**          | A Roll visible only to the GM                                                                | Hidden roll, secret roll     |

## Events

| Term                       | Definition                                                                            | Aliases to avoid         |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------------ |
| **Domain Event**           | A fact that has occurred in the system, published to EventBridge with a `detail-type` | Message, notification    |
| **Event Detail**           | The typed payload of a Domain Event                                                   | Event body, event data   |
| **Event Detail Type**      | The discriminant string that identifies which Domain Event occurred                   | Event name, event type   |
| **Roll Completed**         | Domain Event published when a Roll has been generated and stored                      | Roll done, roll finished |
| **Roll Request Completed** | Domain Event published when all Players have fulfilled a Roll Request                 | Roll request done        |
| **Player Joined**          | Domain Event published when a Player joins a Play Table                               | Player added             |
| **Player Left**            | Domain Event published when a Player leaves a Play Table                              | Player removed           |
| **Initiative Updated**     | Domain Event published when the initiative order changes at a Play Table              | Initiative changed       |

## Step Function workflows

| Term                      | Definition                                                                             | Aliases to avoid                          |
| ------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Roll Pipeline**         | The Step Function workflow that generates, stores, and publishes a completed Roll      | Roll workflow, roll state machine         |
| **Roll Request Pipeline** | The Step Function workflow that persists a Roll Request and waits for Players to roll  | Roll request workflow                     |
| **Step Contract**         | The shared Zod schema defining the input and output types for a step in a pipeline     | Step payload, step interface, step schema |
| **Task Token**            | A Step Functions handle used to pause a pipeline and resume it from an external caller | Wait token, callback token                |

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
- A **Roll Request** targets one or more **Players** and has a **Roll Notation** and optional **DC**
- A **Roll** belongs to one **Player** at one **Play Table** and may be linked to a **Roll Request**
- A **Roll Pipeline** is triggered for each **Roll** and produces a **Roll Completed** event
- A **Roll Request Pipeline** is triggered for each **Roll Request** and waits via **Task Token** until Players fulfil it

## Example dialogue

> **Dev:** "When the GM calls `createRollRequest`, does a **Roll** get created immediately?"

> **Domain expert:** "No — `createRollRequest` starts the **Roll Request Pipeline** and emits a **Roll Request Created** subscription. Each targeted **Player** then calls `createRoll`, which triggers a separate **Roll Pipeline** per **Roll**."

> **Dev:** "So the **Roll Request Pipeline** waits using a **Task Token** until all Players have rolled?"

> **Domain expert:** "Exactly. The pipeline holds the **Task Token** and the **initiative-create-handler** step resumes it once all expected **Rolls** are in. That's when the **Roll Request Completed** event fires."

> **Dev:** "What's the difference between a **Roll** and a **Roll Request**?"

> **Domain expert:** "A **Roll Request** is the GM's instruction — it has a **Roll Notation**, an optional **DC**, and a list of target **Players**. A **Roll** is the actual result one **Player** produced. A single **Roll Request** can produce multiple **Rolls**, one per targeted **Player**."

> **Dev:** "And a **Private Roll** — does the **Player** see it?"

> **Domain expert:** "Yes, the rolling **Player** always sees their own **Roll**. Private means other **Players** can't see it — only the **GM** can."

## Flagged ambiguities

- **"Event"** is overloaded: used for both **Domain Events** (EventBridge, async) and GraphQL subscription events (AppSync, real-time push). Prefer **Domain Event** for EventBridge and **Subscription** for AppSync push.
- **"Schema"** is overloaded: used for GraphQL schema definitions, Zod runtime validators, and database key schemas. Qualify with **GraphQL Schema**, **Zod Schema**, or **key schema** as appropriate.
- **"Module"** is overloaded: used for both npm workspace packages (`shared/schemas`) and game domain modules (`dice-roller`, `play-table`). Prefer **package** for npm workspaces and **module** only for domain boundaries.
- **"Payload"** is used for both Step Contract inputs and Domain Event details. Prefer **Step Contract** for step function I/O and **Event Detail** for EventBridge payloads.
- **"Type"** is heavily overloaded (TypeScript type, GraphQL type, Roll Type, Event Detail Type). Always qualify: **Roll Type**, **Event Detail Type**, **TypeScript type**, **GraphQL type**.
