# AWS Data Pipeline

Event-driven data processing pipeline built with AWS Step Functions, AppSync, EventBridge, and React.

## Architecture

```
React App → AppSync (GraphQL) → Lambda Resolver → EventBridge → SQS → Step Function
                                                                         ├── Ingest
                                                                         ├── Transform
                                                                         ├── Validate
                                                                         └── Store → DynamoDB
```

### AWS Services

| Service | Purpose |
|---------|---------|
| **Amplify** | Frontend hosting with branch-based deploys |
| **Cognito** | User authentication |
| **AppSync** | GraphQL API with real-time subscriptions |
| **EventBridge** | Event bus for decoupled communication |
| **SQS** | Message queue with dead-letter queue |
| **Step Functions** | Orchestrated data processing pipeline |
| **Lambda** | Compute for resolvers and pipeline steps |
| **DynamoDB** | NoSQL data storage |

## Project Structure

```
├── frontend/          React + Vite app
├── backend/           Lambda handlers and shared types
├── infrastructure/    CDK stacks
└── .github/workflows/ CI/CD pipelines
```

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- GitHub repository with Actions enabled

## Initial Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Bootstrap CDK

Run once per AWS account/region:

```bash
cd infrastructure
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1
```

### 3. Set up GitHub OIDC in AWS

Create an IAM OIDC identity provider for GitHub Actions:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Create an IAM role that trusts your GitHub repository:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/aws-step-function-test:*"
        }
      }
    }
  ]
}
```

The role needs permissions for CloudFormation, Lambda, DynamoDB, SQS, EventBridge, AppSync, Cognito, Amplify, IAM (for creating service roles), S3 (CDK assets), and CloudWatch Logs. For initial setup, `AdministratorAccess` works; scope it down later.

### 4. Store the GitHub personal access token

Amplify needs a GitHub token to connect to the repository:

```bash
aws secretsmanager create-secret \
  --name github-token \
  --secret-string "ghp_YOUR_TOKEN_HERE"
```

### 5. Configure GitHub repository secrets

Add the following secret in your repo's Settings > Secrets and variables > Actions:

- `AWS_ROLE_ARN`: The ARN of the IAM role created in step 3

### 6. Create GitHub Environments

In your repo's Settings > Environments, create:

- `development`
- `staging`
- `production` (add required reviewers for approval gate)

## Environments

| Environment | Branch | Trigger | Notes |
|-------------|--------|---------|-------|
| development | `development` | Push | Auto-deploys |
| staging | `staging` | Push | Auto-deploys |
| production | `main` | Push | Requires approval via GitHub Environment |

## Branching Strategy

```
feature/* ──PR──► development ──PR──► staging ──PR──► main
```

1. Create feature branches from `development`
2. Open PR to `development` (triggers CI validation)
3. Merge to `development` (triggers dev deploy)
4. PR from `development` to `staging` (triggers staging deploy)
5. PR from `staging` to `main` (triggers production deploy with approval)

## Deploying Manually

```bash
cd infrastructure

# Deploy to development
ENVIRONMENT=development npx cdk deploy --all

# Deploy a personal sandbox
SANDBOX_DEVELOPER=yourname npx cdk deploy --all

# Tear down a sandbox
SANDBOX_DEVELOPER=yourname npx cdk destroy --all --force
```

## Sandbox Environments

Sandboxes are fully isolated, ephemeral environments for individual developers.

### Deploy via GitHub Actions

1. Go to Actions > "Deploy Sandbox"
2. Click "Run workflow"
3. Enter your name (e.g., `john`)
4. All resources are created with prefix `sandbox-john-`

### Tear down via GitHub Actions

1. Go to Actions > "Teardown Sandbox"
2. Click "Run workflow"
3. Enter the same developer name
4. All resources are destroyed and cleanup is verified

### Sandbox characteristics

- All resources use `RemovalPolicy.DESTROY` for clean teardown
- CloudWatch logs retain for 1 day only
- Point-in-time recovery disabled on DynamoDB (cost savings)
- No Amplify branch auto-build (frontend deployed as part of CDK)

## Local Frontend Development

```bash
# Copy environment file and fill in values from CDK outputs
cp frontend/.env.example frontend/.env

# Start dev server
cd frontend
npm run dev
```

## Commit Convention

This project follows [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

```
<type>(scope): <description>
```

**Types:** `feat`, `fix`, `build`, `chore`, `ci`, `docs`, `refactor`, `test`

**Scopes:** `infra`, `backend`, `frontend`
