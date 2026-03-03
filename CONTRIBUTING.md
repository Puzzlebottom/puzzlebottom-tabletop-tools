# Contributing

This guide summarizes how to contribute to Puzzlebottom's Tabletop Tools Suite. For detailed setup, architecture, and deployment instructions, see the [README](README.md).

## Getting Started

1. **Prerequisites.** Ensure you have Node.js 24+, AWS CLI, CDK CLI, and GitHub CLI configured. See [README – Prerequisites](README.md#prerequisites) for the full list.

2. **Install dependencies.**

   ```bash
   npm install
   ```

3. **Initial setup.** Follow [README – Initial Setup](README.md#initial-setup) for CDK bootstrap and GitHub OIDC configuration. The automated script (`npm run setup:aws`) is recommended.

4. **Branch from `development`.** Create feature branches from `development`; do not branch from `staging` or `main`.

## Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature development`
2. Make changes and run tests locally (see [Testing & Linting](#testing--linting))
3. Commit using [Conventional Commits](#commit-convention) (enforced by commitlint)
4. Push and open a PR to `development`
5. After review and merge, changes deploy to development automatically

For promotion to staging and production, see [README – Branching Strategy](README.md#branching-strategy).

## Testing & Linting

| Command                 | Purpose                                |
| ----------------------- | -------------------------------------- |
| `npm run test`          | Run all workspace tests                |
| `npm run test:coverage` | Run tests with coverage (CI uses this) |
| `npm run lint`          | Lint all workspaces                    |
| `npm run lint:fix`      | Auto-fix lint issues                   |
| `npm run format:check`  | Check Prettier formatting              |
| `npm run format`        | Format code with Prettier              |
| `npm run typecheck`     | Type-check all workspaces              |
| `npm run codegen:check` | Ensure GraphQL types match schema      |

**Git hooks** run automatically:

- **pre-commit:** lint-staged (ESLint + Prettier on staged files), then tests
- **commit-msg:** commitlint enforces Conventional Commits
- **pre-push:** format check, codegen check, full lint, typecheck, and tests

See [README – Git Hooks](README.md#git-hooks) for details.

## Sandbox Usage

Sandboxes are ephemeral environments for feature branches. Use them to test changes in isolation before merging.

| Action   | Command                    |
| -------- | -------------------------- |
| Deploy   | `npm run sandbox:deploy`   |
| Teardown | `npm run sandbox:teardown` |

The deploy script derives the sandbox identifier from your branch and dev name (one sandbox per dev+branch). Re-deploying updates the existing sandbox in-place. Teardown removes your sandbox for the current branch. Sandboxes are also auto-cleaned when a branch is deleted. For local frontend dev, set `SANDBOX_DEVELOPER` to your GitHub username if `git config user.name` doesn't match.

For manual deployment, GitHub Actions workflows, and sandbox characteristics, see [README – Sandbox Environments](README.md#sandbox-environments).

## Code Style & Architecture

### Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[optional scope]: <description>
```

**Types:** `feat`, `fix`, `docs`, `chore`, `style`, `refactor`, `perf`, `test`, `ci`

**Scopes (optional):** `infra`, `backend`, `frontend`, `ci`, `scripts`

### Architecture Boundaries

`eslint-plugin-boundaries` enforces layer imports. See [README – Architecture Boundaries](README.md#architecture-boundaries) for the layer rules.

### GraphQL Schema Changes

When you change `infrastructure/lib/graphql/schema.graphql`:

1. Run `npm run codegen` to regenerate TypeScript types and Zod schemas
2. Commit the updated `shared/graphql-types/src/generated.ts`

Pre-push and CI run `codegen:check` to catch drift.

The GraphQL schema is the single source of truth for domain types. Both TypeScript types and Zod validation schemas derive from it.

### Runtime Validation (Zod)

Payload and event shapes use Zod schemas in `shared/schemas`. See [README – Runtime Validation (Zod)](README.md#runtime-validation-zod) for schema usage.

## Getting Help

- **Setup issues:** Check [README – Initial Setup](README.md#initial-setup) and [README – Local Frontend Development](README.md#local-frontend-development)
- **Deployment:** See [README – Deploying Manually](README.md#deploying-manually) and [README – Sandbox Environments](README.md#sandbox-environments)
- **Architecture:** See [README – Architecture](README.md#architecture) and [README – Architecture Boundaries](README.md#architecture-boundaries)
- **Releases:** See [README – Releasing](README.md#releasing)

When in doubt, open an issue or ask in your PR.
