# Architecture & Flow

Visual documentation of the Puzzlebottom's Tabletop Tools Suite application flow. The first tool is the **Dice Roller** — a shared play table where GMs and players roll d20s, with initiative ordering and real-time updates.

**Color scheme:** Gradient along the data flow (blue → indigo → purple → green). Error paths (Fail, DLQ) use red.

## Dice Roller Data Flow (Mermaid)

```mermaid
flowchart TB
    subgraph Frontend["Frontend"]
        User[User]
        Auth[Cognito Auth]
        DiceLanding[Dice Landing]
        CreateTable[Create Play Table]
        JoinTable[Join Play Table]
        PlayTable[Play Table Page]
        DiceRoller[DiceRoller 3D]
        RollLog[Roll Log]
        InitiativeList[Initiative List]
        User --> Auth
        Auth --> DiceLanding
        DiceLanding --> CreateTable
        DiceLanding --> JoinTable
        CreateTable --> PlayTable
        JoinTable --> PlayTable
        PlayTable --> DiceRoller
        PlayTable --> RollLog
        PlayTable --> InitiativeList
    end

    subgraph API["API Layer"]
        AppSync[AppSync GraphQL]
        Subscriptions[Subscriptions]
        DiceRoller -->|rollDice mutation| AppSync
        PlayTable -->|createRollRequest, fulfillRollRequest| AppSync
        PlayTable -->|playTable, rollHistory queries| AppSync
        AppSync --> Subscriptions
        Subscriptions -.->|onRollCompleted, onRollRequestCreated, onInitiativeUpdated| PlayTable
    end

    subgraph Resolvers["Resolvers"]
        RollDice[roll-dice Lambda]
        PlayTableRes[play-table Lambda]
        RollRequest[roll-request Lambda]
        Initiative[initiative Lambda]
        AppSync --> RollDice
        AppSync --> PlayTableRes
        AppSync --> RollRequest
        AppSync --> Initiative
    end

    subgraph RollPipeline["Roll Step Function"]
        RollSF[State Machine]
        GenerateResult[Generate Roll Result]
        StoreRoll[Store in DynamoDB]
        NotifySubscribers[notifyRollCompleted]
        PublishRollEvent[PutEvents RollCompleted]
        RollSF --> GenerateResult
        GenerateResult --> StoreRoll
        StoreRoll --> NotifySubscribers
        NotifySubscribers --> PublishRollEvent
    end

    RollDice -->|StartExecution| RollSF
    NotifySubscribers -->|notifyRollCompleted| AppSync
    StoreRoll --> DynamoDB
    PublishRollEvent --> EB

    subgraph RollRequestPipeline["Roll Request Step Function"]
        ReqSF[State Machine]
        PersistReq[PersistRollRequest]
        InitiativeCreate[InitiativeCreateHandler]
        PublishReqCompleted[PutEvents RollRequestCompleted]
        ReqSF --> PersistReq
        PersistReq --> InitiativeCreate
        InitiativeCreate -->|wait for players| PublishReqCompleted
        RollCompletedHandler -.->|SendTaskSuccess| InitiativeCreate
    end

    RollRequest -->|StartExecution| ReqSF
    PersistReq --> DynamoDB
    InitiativeCreate --> DynamoDB
    PublishReqCompleted --> EB

    subgraph Eventing["Eventing"]
        EB[EventBridge]
        RuleRC[Rule: RollCompleted]
        RuleRRC[Rule: RollRequestCompleted]
        RulePL[Rule: PlayerLeft]
        RulePJ[Rule: PlayerJoined]
        SQS[SQS Pipeline Queue]
        DLQ[Dead Letter Queue]
        EB --> RuleRC
        EB --> RuleRRC
        EB --> RulePL
        EB --> RulePJ
        RuleRC --> SQS
        RuleRRC --> SQS
        RulePL --> SQS
        RulePJ --> SQS
        SQS -.->|after 3 failures| DLQ
    end

    subgraph Trigger["Trigger & Handlers"]
        TriggerFn[trigger Lambda]
        RollCompletedHandler[roll-completed Lambda]
        PlayerLeftHandler[player-left Lambda]
        PlayerJoinedHandler[player-joined Lambda]
        SQS -->|batch| TriggerFn
        TriggerFn -->|initiative RollCompleted: Invoke| RollCompletedHandler
        TriggerFn -->|PlayerLeft: Invoke| PlayerLeftHandler
        TriggerFn -->|PlayerJoined: Invoke| PlayerJoinedHandler
    end

    subgraph Storage["Storage"]
        DynamoDB[(DynamoDB)]
        PlayTableRes --> DynamoDB
        Initiative --> DynamoDB
        RollCompletedHandler --> DynamoDB
    end

    style User fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style DiceRoller fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style PlayTable fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style AppSync fill:#4f46e5,stroke:#4338ca,color:#fff
    style EB fill:#6366f1,stroke:#4f46e5,color:#fff
    style SQS fill:#7c3aed,stroke:#6d28d9,color:#fff
    style DLQ fill:#dc2626,stroke:#b91c1c,color:#fff
    style RollDice fill:#4f46e5,stroke:#4338ca,color:#fff
    style TriggerFn fill:#7c3aed,stroke:#6d28d9,color:#fff
    style RollSF fill:#7c3aed,stroke:#6d28d9,color:#fff
    style GenerateResult fill:#4f46e5,stroke:#4338ca,color:#fff
    style StoreRoll fill:#22c55e,stroke:#16a34a,color:#fff
    style NotifySubscribers fill:#22c55e,stroke:#16a34a,color:#fff
    style PublishRollEvent fill:#6366f1,stroke:#4f46e5,color:#fff
    style ReqSF fill:#7c3aed,stroke:#6d28d9,color:#fff
    style PersistReq fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style InitiativeCreate fill:#4f46e5,stroke:#4338ca,color:#fff
    style PublishReqCompleted fill:#22c55e,stroke:#16a34a,color:#fff
    style DynamoDB fill:#22c55e,stroke:#16a34a,color:#fff
```

## Roll Request Step Function Detail

```mermaid
stateDiagram-v2
    [*] --> PersistRollRequest: createRollRequest mutation<br/>resolver starts execution

    PersistRollRequest: Write RollRequest to DynamoDB<br/>completedPlayerKeys: []

    PersistRollRequest --> InitiativeCreateHandler: Choice by type

    InitiativeCreateHandler: Update RollRequest with taskToken<br/>notifyRollRequestCreated → AppSync<br/>Wait for task token

    state "Players roll (fulfillRollRequest)" as Players
    InitiativeCreateHandler --> Players: Task token stored
    Players --> InitiativeCreateHandler: roll-completed handler<br/>SendTaskSuccess when all done

    PublishRollRequestCompleted: PutEvents RollRequestCompleted

    InitiativeCreateHandler --> PublishRollRequestCompleted: All players rolled
    PublishRollRequestCompleted --> [*]: Success

    style PersistRollRequest fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style InitiativeCreateHandler fill:#4f46e5,stroke:#4338ca,color:#fff
    style PublishRollRequestCompleted fill:#22c55e,stroke:#16a34a,color:#fff
```

## Roll Notification Flow

The subscription is the sole source of truth for roll results in the UI. The `rollDice` and `fulfillRollRequest` mutations return only a minimal acknowledgment (`rollId` + `accepted`), not the roll result. The `rollId` is a correlation token — the client needs it to identify which incoming subscription result belongs to its pending roll.

### Precondition: subscription established at page load

When the PlayTable page mounts, the client subscribes to `onRollCompleted(playTableId)` via WebSocket. AppSync confirms the subscription (`subscription_ack`), and the client is guaranteed to receive all matching events for the lifetime of the connection. The `onRollCompleted` subscription is bound to the `notifyRollCompleted` mutation — not to the user-facing `rollDice`/`fulfillRollRequest` mutations. This subscription is long-lived and predates any roll.

### Per-roll flow

1. Client calls `rollDice` or `fulfillRollRequest` mutation
2. roll-dice Lambda validates the request, generates a `rollId`, starts the Roll Step Function (async), and returns `RollDiceResponse` (`rollId` + `accepted`) — no roll result
3. Client receives `rollId` and stores it as the pending roll to match against incoming subscription results
4. Roll Step Function executes (async, after the Lambda has returned):
   a. Generate roll result (dice values, total, etc.)
   b. Store in DynamoDB
   c. Call `notifyRollCompleted` mutation on AppSync (HTTP + IAM auth) — AppSync responds confirming the mutation was processed, then pushes the `RollResult` to all active subscribers
   d. Publish `RollCompleted` event to EventBridge (inter-module communication — other modules can react to rolls)
5. Subscribed clients receive `RollResult` via `onRollCompleted`, match on `rollId`, and update the UI

The roll-dice Lambda is a thin entry point — it handles validation (play table exists, player is a target, roll request is pending, etc.) and returns the `rollId` immediately. The Step Function handles the ordered pipeline of result generation, storage, and subscriber notification. This guarantees the client has the `rollId` (step 3) before the subscription result arrives (step 5).

EventBridge publication (`RollCompleted` event) is a separate, secondary concern for inter-module communication — not part of the roll notification flow.

## Initiative Roll Request Notification Flow

The `onRollRequestCreated` subscription is the sole source of truth for roll request UI updates. The `createRollRequest` mutation returns a minimal acknowledgment (`rollRequestId` + `accepted`) — full RollRequest comes from the subscription.

1. GM calls `createRollRequest` mutation (Cognito auth)
2. roll-request Lambda validates (GM owns play table), generates `rollRequestId`, starts Roll Request Step Function, returns `CreateRollRequestResponse` (`rollRequestId`, `accepted`)
3. Roll Request Step Function: PersistRollRequest writes RollRequest to DynamoDB; InitiativeCreateHandler updates with taskToken, calls `notifyRollRequestCreated` mutation (IAM auth)
4. AppSync pushes to all `onRollRequestCreated` subscribers
5. Players receive the roll request and can fulfill it
6. When all players have rolled, roll-completed handler calls SendTaskSuccess; Step Function publishes `RollRequestCompleted` to EventBridge (for persistence/audit)

This mirrors the roll flow: the pipeline (Step Function) is the source of UI updates via IAM-authed notify mutations.

## Component Summary

| Component           | Technology              | Responsibility                                                                                                              |
| ------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**        | React, Vite, Amplify UI | Dice roller UI, Cognito auth, 3D dice (Three.js), GraphQL client                                                            |
| **AppSync**         | AWS AppSync             | GraphQL API, auth (Cognito/API key), real-time subscriptions                                                                |
| **roll-dice**       | Lambda                  | Validate request, generate rollId, start Roll Step Function, return acknowledgment                                          |
| **Roll SF**         | Step Function           | Generate roll result, store in DynamoDB, notify subscribers via `notifyRollCompleted`, publish RollCompleted to EventBridge |
| **play-table**      | Lambda                  | Create/join play tables, leave, query play table and roll history                                                           |
| **roll-request**    | Lambda                  | Validate GM, start Roll Request Step Function, return CreateRollRequestResponse                                             |
| **initiative**      | Lambda                  | clearInitiative, notifyRollRequestCreated, notifyInitiativeUpdated                                                          |
| **EventBridge**     | AWS EventBridge         | Decouple mutations from async processing                                                                                    |
| **SQS**             | AWS SQS                 | Queue for trigger Lambda, DLQ for failures                                                                                  |
| **trigger**         | Lambda                  | Route events: invoke roll-completed, player-left, player-joined; persist RollRequestCompleted                               |
| **roll-completed**  | Lambda                  | Update RollRequest completedPlayerKeys; SendTaskSuccess with RollRequestCompleted payload when all rolled                   |
| **Roll Request SF** | AWS Step Functions      | PersistRollRequest → Choice → InitiativeCreateHandler (WAIT) → PublishRollRequestCompleted                                  |
| **DynamoDB**        | AWS DynamoDB            | PlayTable, Player, Roll, RollRequest, Initiative                                                                            |

## Event Types

| detailType           | Source                      | Publisher            | Consumer                                   |
| -------------------- | --------------------------- | -------------------- | ------------------------------------------ |
| RollCompleted        | puzzlebottom-tabletop-tools | Roll Step Function   | trigger → roll-completed (initiative only) |
| RollRequestCompleted | puzzlebottom-tabletop-tools | Roll Request Step Fn | trigger (persist only)                     |
| PlayerLeft           | puzzlebottom-tabletop-tools | play-table Lambda    | trigger → player-left Lambda               |
| PlayerJoined         | puzzlebottom-tabletop-tools | play-table Lambda    | trigger → player-joined Lambda             |

## Data Shapes

### RollCompleted (roll-dice → EventBridge)

```ts
{
  playTableId: string,
  rollId: string,
  rollRequestId?: string,
  rollRequestType: 'ad_hoc' | 'initiative',
  rollerId: string,
  rollerType: 'gm' | 'player',
  values: number[],
  modifier: number,
  total: number,
  advantage?: string | null,
  dc?: number | null,
  success?: boolean | null
}
```

### RollRequestCompleted (Roll Request Step Function → EventBridge)

```ts
{
  playTableId: string,
  rollRequestId: string,
  type: 'initiative',
  timestamps: { createdAt: string, completedAt: string },
  playerIds: string[],
  rollIds: string[],
  initiatedBy: string
}
```

### DynamoDB Items (dice roller)

| Entity      | PK               | SK                  | Description                                                        |
| ----------- | ---------------- | ------------------- | ------------------------------------------------------------------ |
| PlayTable   | `PLAYTABLE#<id>` | `METADATA`          | GM, invite code, createdAt                                         |
| Player      | `PLAYTABLE#<id>` | `PLAYER#<playerId>` | characterName, initiativeModifier                                  |
| Roll        | `PLAYTABLE#<id>` | `ROLL#<rollId>`     | values, modifier, total, visibility                                |
| RollRequest | `PLAYTABLE#<id>` | `ROLLREQUEST#<id>`  | targetPlayerIds, type, taskToken, completedPlayerKeys, initiatedBy |
