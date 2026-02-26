#!/usr/bin/env bash
set -euo pipefail

# Destroys CDK stacks in parallel waves by reading the dependency graph
# from the synthesized manifest. Independent stacks within each wave are
# deleted concurrently, while respecting cross-stack dependency ordering.
#
# Usage: Run from the CDK project directory (where cdk.json lives).
#   ./parallel-cdk-destroy.sh [CDK_SYNTH_ARGS...]
#
# All arguments are forwarded to `cdk synth`.

echo "=== Parallel CDK Destroy ==="

echo "Synthesizing CDK app..."
npx cdk synth "$@" > /dev/null

MANIFEST="cdk.out/manifest.json"
if [ ! -f "$MANIFEST" ]; then
  echo "Error: $MANIFEST not found after synth."
  exit 1
fi

# Compute destroy waves from the manifest dependency graph.
# Outputs one line per wave, with stack names space-separated.
WAVES=$(node -e '
  var fs = require("fs");
  var manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  var artifacts = manifest.artifacts;

  var stacks = Object.keys(artifacts)
    .filter(function(k) { return artifacts[k].type === "aws:cloudformation:stack"; });

  if (stacks.length === 0) { process.exit(0); }

  var stackSet = {};
  stacks.forEach(function(s) { stackSet[s] = true; });

  var dependents = {};
  stacks.forEach(function(s) { dependents[s] = []; });

  stacks.forEach(function(stack) {
    (artifacts[stack].dependencies || []).forEach(function(dep) {
      if (stackSet[dep]) { dependents[dep].push(stack); }
    });
  });

  var remaining = {};
  stacks.forEach(function(s) { remaining[s] = true; });
  var count = stacks.length;

  while (count > 0) {
    var wave = Object.keys(remaining).filter(function(s) {
      return dependents[s].every(function(d) { return !remaining[d]; });
    });
    if (wave.length === 0) {
      console.error("Error: Circular dependency among: " + Object.keys(remaining).join(", "));
      process.exit(1);
    }
    console.log(wave.join(" "));
    wave.forEach(function(s) { delete remaining[s]; });
    count -= wave.length;
  }
' "$MANIFEST")

if [ -z "$WAVES" ]; then
  echo "No stacks found in manifest."
  exit 0
fi

TOTAL=$(echo "$WAVES" | tr ' ' '\n' | wc -l | tr -d ' ')
echo "Found $TOTAL stacks across $(echo "$WAVES" | wc -l | tr -d ' ') waves."

WAVE_NUM=0
echo "$WAVES" | while IFS= read -r WAVE_LINE; do
  WAVE_NUM=$((WAVE_NUM + 1))
  echo ""
  echo "--- Wave $WAVE_NUM ---"
  for STACK in $WAVE_LINE; do
    echo "  $STACK"
  done

  for STACK in $WAVE_LINE; do
    aws cloudformation delete-stack --stack-name "$STACK"
  done

  PIDS=""
  for STACK in $WAVE_LINE; do
    (
      if aws cloudformation wait stack-delete-complete --stack-name "$STACK" 2>/dev/null; then
        echo "  ✓ $STACK"
      else
        echo "  ✗ $STACK"
        exit 1
      fi
    ) &
    PIDS="$PIDS $!"
  done

  FAILED=0
  for PID in $PIDS; do
    wait "$PID" || FAILED=$((FAILED + 1))
  done

  if [ $FAILED -gt 0 ]; then
    echo ""
    echo "Error: $FAILED stack(s) failed to delete in wave $WAVE_NUM"
    exit 1
  fi
done

echo ""
echo "All stacks destroyed successfully."
