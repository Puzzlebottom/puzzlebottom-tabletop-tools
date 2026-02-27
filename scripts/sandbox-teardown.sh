#!/usr/bin/env bash
set -euo pipefail

WORKFLOW_FILE="sandbox-teardown.yml"
PROTECTED_BRANCHES=("development" "staging" "main")

usage() {
  echo "Usage: $0"
  echo
  echo "Triggers the sandbox teardown workflow using GitHub CLI."
  echo
  echo "No arguments are accepted."
  echo "The script derives branch + hash from the current checkout and triggers"
  echo "branch-based teardown to remove any sandbox for this branch."
  echo "Protected branches are blocked: development, staging, main."
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: Required command '$1' is not installed or not in PATH."
    exit 1
  fi
}

is_protected_branch() {
  local branch="$1"
  for protected in "${PROTECTED_BRANCHES[@]}"; do
    if [[ "$branch" == "$protected" ]]; then
      return 0
    fi
  done
  return 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -gt 0 ]]; then
  echo "Error: This script does not accept arguments."
  usage
  exit 1
fi

require_command gh
require_command git

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: GitHub CLI is not authenticated."
  echo "Run: gh auth login"
  exit 1
fi

branch_name="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ -z "$branch_name" || "$branch_name" == "HEAD" ]]; then
  echo "Error: Could not determine current branch."
  echo "Run this script from a local branch checkout."
  exit 1
fi

if is_protected_branch "$branch_name"; then
  echo "Error: Sandbox teardown is blocked on protected branch '${branch_name}'."
  echo "Switch to a feature branch and try again."
  exit 1
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
sandbox_identifier="$("$script_dir/sandbox-identifier.sh")"

echo "Dispatching workflow '${WORKFLOW_FILE}'..."
echo "  branch:             ${branch_name}"
echo "  sandbox_identifier: ${sandbox_identifier}"

gh workflow run "$WORKFLOW_FILE" \
  --ref "$branch_name" \
  -f branch_name="$branch_name"

echo "Sandbox teardown workflow dispatched successfully."
echo "Track runs with: gh run list --workflow \"Teardown Sandbox\" --limit 5"
