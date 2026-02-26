#!/usr/bin/env bash
set -euo pipefail

# Single source of truth for sandbox identifier logic (branch-slug + short-sha).
# Used by sandbox-deploy, sandbox-teardown, frontend-dev, and GitHub Actions.

slugify() {
  printf "%s" "${1:-}" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g'
}

usage() {
  echo "Usage: $0 [options]"
  echo
  echo "Outputs sandbox identifier (branch-slug-shortsha) or slugified string."
  echo
  echo "Options:"
  echo "  --slugify STR    Output slugified STR only (no sha)"
  echo "  -h, --help       Show this help"
  echo
  echo "With no options: derives from current git branch and HEAD commit."
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

# --slugify: output slugified string only
if [[ "${1:-}" == "--slugify" ]]; then
  if [[ -z "${2:-}" ]]; then
    echo "Error: --slugify requires an argument."
    exit 1
  fi
  slugify "$2"
  exit 0
fi

# Default: from git (works locally and in CI after checkout)
branch_name="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ -z "$branch_name" || "$branch_name" == "HEAD" ]]; then
  echo "Error: Could not determine current branch."
  exit 1
fi

branch_slug="$(slugify "$branch_name")"
short_sha="$(git rev-parse --short=7 HEAD 2>/dev/null || true)"
if [[ -z "$branch_slug" || -z "$short_sha" ]]; then
  echo "Error: Could not derive branch slug and commit hash."
  exit 1
fi

echo "${branch_slug}-${short_sha}"
