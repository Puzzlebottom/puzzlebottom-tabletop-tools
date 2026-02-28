# Architecture & Flow

Visual documentation of the AWS Data Pipeline application flow.

**Color scheme:** Gradient along the data flow (blue → indigo → purple → green). Error paths (Fail, DLQ) use red.

## Detailed Data Flow (Mermaid)

```mermaid
flowchart TB
    subgraph Frontend["Frontend"]
        User[User]
        Form[SubmitDataForm]
        Auth[Cognito Auth]
        User --> Auth
        Auth --> Form
    end

    subgraph API["API Layer"]
        AppSync[AppSync GraphQL]
        Form -->|submitData mutation| AppSync
    end

    subgraph Eventing["Eventing"]
        EB[EventBridge]
        Rule[Rule: source=data-pipeline<br/>detailType=DataSubmitted]
        SQS[SQS Pipeline Queue]
        DLQ[Dead Letter Queue]
        EB --> Rule
        Rule --> SQS
        SQS -.->|after 3 failures| DLQ
    end

    subgraph Resolvers["Resolvers"]
        SubmitData[submit-data Lambda]
        AppSync --> SubmitData
        SubmitData -->|PutEvents| EB
    end

    subgraph Pipeline["Step Function Pipeline"]
        Trigger[trigger Lambda]
        SF[State Machine]
        Ingest[Ingest]
        Transform[Transform]
        Validate[Validate]
        Store[Store]
        Success[Success]
        Fail[Fail]

        SQS -->|batch trigger| Trigger
        Trigger -->|StartExecution| SF
        SF --> Ingest --> Transform --> Validate --> Store --> Success
        Ingest --> Fail
        Transform --> Fail
        Validate --> Fail
        Store --> Fail
    end

    subgraph Storage["Storage"]
        DynamoDB[(DynamoDB)]
        Store --> DynamoDB
    end

    style User fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style Form fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style Auth fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style AppSync fill:#4f46e5,stroke:#4338ca,color:#fff
    style EB fill:#6366f1,stroke:#4f46e5,color:#fff
    style Rule fill:#6366f1,stroke:#4f46e5,color:#fff
    style SQS fill:#7c3aed,stroke:#6d28d9,color:#fff
    style DLQ fill:#dc2626,stroke:#b91c1c,color:#fff
    style SubmitData fill:#4f46e5,stroke:#4338ca,color:#fff
    style Trigger fill:#7c3aed,stroke:#6d28d9,color:#fff
    style SF fill:#7c3aed,stroke:#6d28d9,color:#fff
    style Ingest fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style Transform fill:#6366f1,stroke:#4f46e5,color:#fff
    style Validate fill:#7c3aed,stroke:#6d28d9,color:#fff
    style Store fill:#22c55e,stroke:#16a34a,color:#fff
    style Success fill:#22c55e,stroke:#16a34a,color:#fff
    style DynamoDB fill:#22c55e,stroke:#16a34a,color:#fff
    style Fail fill:#dc2626,stroke:#b91c1c,color:#fff
```

## Step Function Pipeline Detail

```mermaid
stateDiagram-v2
    [*] --> Ingest: SQS message triggers<br/>trigger Lambda starts execution

    Ingest: Validate StepInput<br/>Check payload size (max 1MB)<br/>Add ingested flag

    Transform: Normalize keys<br/>trim, lowercase, replace spaces

    Validate: Check id, source<br/>Ensure payload not empty

    Store: Write to DynamoDB<br/>PK = RECORD#id, SK = PIPELINE#pipelineId

    Ingest --> Transform: IngestOutput
    Transform --> Validate: TransformOutput
    Validate --> Store: ValidateOutput
    Store --> [*]: Success

    Ingest --> [*]: Fail (retry 2x)
    Transform --> [*]: Fail (retry 2x)
    Validate --> [*]: Fail (retry 2x)
    Store --> [*]: Fail (retry 2x)

    style Ingest fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style Transform fill:#6366f1,stroke:#4f46e5,color:#fff
    style Validate fill:#7c3aed,stroke:#6d28d9,color:#fff
    style Store fill:#22c55e,stroke:#16a34a,color:#fff
```

## Component Summary

| Component         | Technology              | Responsibility                                              |
| ----------------- | ----------------------- | ----------------------------------------------------------- |
| **Frontend**      | React, Vite, Amplify UI | Submit form, Cognito auth, GraphQL client                   |
| **AppSync**       | AWS AppSync             | GraphQL API, auth (Cognito/IAM), subscriptions              |
| **submit-data**   | Lambda                  | Validate payload, create DataRecord, publish to EventBridge |
| **EventBridge**   | AWS EventBridge         | Decouple submission from processing                         |
| **SQS**           | AWS SQS                 | Queue for pipeline trigger, DLQ for failures                |
| **trigger**       | Lambda                  | Parse SQS, start Step Function execution                    |
| **Step Function** | AWS Step Functions      | Orchestrate Ingest → Transform → Validate → Store           |
| **DynamoDB**      | AWS DynamoDB            | Persist processed records                                   |

## Event & Data Shapes

### DataRecord (submit-data → EventBridge → SQS → trigger)

```ts
{
  id: string,           // UUID
  source: string,       // e.g. "sensor-data"
  payload: object,      // JSON object
  submittedAt: string,  // ISO timestamp
  submittedBy: string   // Cognito sub or "anonymous"
}
```

### StepInput (trigger → Step Function)

```ts
{
  record: DataRecord,
  pipelineId: string,   // UUID for execution
  timestamp: string     // ISO timestamp
}
```

### DynamoDB Item (store output)

| Attribute   | Description                                   |
| ----------- | --------------------------------------------- |
| PK          | `RECORD#<recordId>`                           |
| SK          | `PIPELINE#<pipelineId>`                       |
| GSI1PK      | `SOURCE#<source>`                             |
| GSI1SK      | `submittedAt`                                 |
| payload     | Normalized payload (keys trimmed, lowercased) |
| processedAt | ISO timestamp                                 |
