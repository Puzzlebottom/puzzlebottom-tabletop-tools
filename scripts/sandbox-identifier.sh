#!/usr/bin/env bash
set -euo pipefail

# Single source of truth for sandbox identifier logic (branch-slug + hash(dev)).
# One sandbox per (dev, branch); re-deploy updates in-place.
# Different devs with same branch get different sandboxes.
# Used by sandbox-deploy, sandbox-teardown, frontend-dev, and GitHub Actions.

slugify() {
  printf "%s" "${1:-}" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g'
}

# Returns first 7 chars of SHA-256 of dev name (lowercased, trimmed).
# Dev name: SANDBOX_DEVELOPER env, or git config user.name, or whoami.
hash_dev() {
  local dev="${SANDBOX_DEVELOPER:-}"
  if [[ -z "$dev" ]]; then
    dev="$(git config user.name 2>/dev/null || true)"
  fi
  if [[ -z "$dev" ]]; then
    dev="$(whoami 2>/dev/null || true)"
  fi
  if [[ -z "$dev" ]]; then
    echo "Error: Could not determine dev name. Set SANDBOX_DEVELOPER or configure git user.name."
    exit 1
  fi
  dev="$(printf '%s' "$dev" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$dev" | sha256sum | cut -c1-7
  else
    printf '%s' "$dev" | shasum -a 256 | cut -c1-7
  fi
}

usage() {
  echo "Usage: $0 [options]"
  echo
  echo "Outputs sandbox identifier (branch-slug-hash) or slugified string."
  echo
  echo "Options:"
  echo "  --slugify STR    Output slugified STR only (for overrides)"
  echo "  -h, --help       Show this help"
  echo
  echo "With no options: derives from current git branch + dev name."
  echo "Format: <branch-slug>-<hash(dev)> e.g. feature-auth-a1b2c3d"
  echo "Dev name: SANDBOX_DEVELOPER env, or git config user.name, or whoami."
  echo "In CI, set SANDBOX_DEVELOPER to github.actor for consistency."
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

# --slugify: output slugified string only (used for manual overrides)
if [[ "${1:-}" == "--slugify" ]]; then
  if [[ -z "${2:-}" ]]; then
    echo "Error: --slugify requires an argument."
    exit 1
  fi
  slugify "$2"
  exit 0
fi

# Default: from git branch + dev hash
branch_name="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ -z "$branch_name" || "$branch_name" == "HEAD" ]]; then
  echo "Error: Could not determine current branch."
  exit 1
fi

branch_slug="$(slugify "$branch_name")"
if [[ -z "$branch_slug" ]]; then
  echo "Error: Could not derive branch slug."
  exit 1
fi

dev_hash="$(hash_dev)"
echo "${branch_slug}-${dev_hash}"
