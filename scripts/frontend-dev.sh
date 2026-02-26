#!/usr/bin/env bash
set -euo pipefail

# Fetches frontend env vars from a deployed stack and launches the dev server.
# Detects environment from current branch, or use FRONTEND_ENV to override.

usage() {
  echo "Usage: $0"
  echo
  echo "Fetches Cognito and AppSync config from a deployed stack and starts the frontend dev server."
  echo
  echo "Environment is derived from the current branch:"
  echo "  development -> development stack"
  echo "  staging     -> staging stack"
  echo "  main        -> production stack"
  echo "  feature/*   -> sandbox-<branch-slug>-<short-sha> (must be deployed first)"
  echo
  echo "Override: set FRONTEND_ENV to development, staging, production, or sandbox-<id>"
  echo
  echo "Requires: git, aws CLI, npm"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: Required command '$1' is not installed or not in PATH."
    exit 1
  fi
}

slugify() {
  tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g'
}

stack_exists() {
  local stack="$1"
  aws cloudformation describe-stacks --stack-name "$stack" &>/dev/null
}

get_output() {
  local stack="$1"
  local key="$2"
  aws cloudformation describe-stacks \
    --stack-name "$stack" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue" \
    --output text
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

require_command git
require_command aws
require_command npm

# Resolve environment
if [[ -n "${FRONTEND_ENV:-}" ]]; then
  env_prefix="$FRONTEND_ENV"
  echo "Using FRONTEND_ENV: ${env_prefix}"
else
  branch_name="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ -z "$branch_name" || "$branch_name" == "HEAD" ]]; then
    echo "Error: Could not determine current branch."
    echo "Run from a branch checkout, or set FRONTEND_ENV (e.g. FRONTEND_ENV=development)."
    exit 1
  fi

  case "$branch_name" in
    development) env_prefix="development" ;;
    staging) env_prefix="staging" ;;
    main) env_prefix="production" ;;
    *)
      branch_slug="$(printf "%s" "$branch_name" | slugify)"
      short_sha="$(git rev-parse --short=7 HEAD 2>/dev/null || true)"
      if [[ -z "$branch_slug" || -z "$short_sha" ]]; then
        echo "Error: Could not derive branch slug and commit hash."
        exit 1
      fi
      env_prefix="sandbox-${branch_slug}-${short_sha}"
      echo "Feature branch detected: ${branch_name} -> ${env_prefix}"
      ;;
  esac
fi

auth_stack="${env_prefix}-AuthStack"
api_stack="${env_prefix}-ApiStack"

echo "Checking for deployed stacks..."

if ! stack_exists "$auth_stack"; then
  echo "Error: Stack '${auth_stack}' not found."
  if [[ "$env_prefix" == sandbox-* ]]; then
    echo "Deploy a sandbox first: npm run sandbox:deploy"
  else
    echo "Deploy the stack first (push to the ${env_prefix} branch or run CDK deploy manually)."
  fi
  exit 1
fi

if ! stack_exists "$api_stack"; then
  echo "Error: Stack '${api_stack}' not found."
  echo "Deploy the stack first."
  exit 1
fi

echo "Fetching outputs from ${env_prefix}..."

user_pool_id="$(get_output "$auth_stack" "UserPoolId")"
user_pool_client_id="$(get_output "$auth_stack" "UserPoolClientId")"
graphql_endpoint="$(get_output "$api_stack" "GraphQLApiUrl")"

if [[ -z "$user_pool_id" || -z "$user_pool_client_id" || -z "$graphql_endpoint" ]]; then
  echo "Error: Could not fetch all required outputs. Check stack outputs."
  exit 1
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
env_file="$repo_root/frontend/.env"
mkdir -p "$(dirname "$env_file")"

cat > "$env_file" << EOF
VITE_USER_POOL_ID=${user_pool_id}
VITE_USER_POOL_CLIENT_ID=${user_pool_client_id}
VITE_GRAPHQL_ENDPOINT=${graphql_endpoint}
EOF

echo "Wrote ${env_file}"
echo "Starting frontend dev server for ${env_prefix}..."
echo ""

exec npm run dev --workspace=frontend
