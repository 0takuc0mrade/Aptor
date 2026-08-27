#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "$0")/.." && pwd)"
repo_dir="$(cd "$workspace_dir/../.." && pwd)"
snarkjs_bin="$repo_dir/node_modules/.bin/snarkjs"

node "$workspace_dir/scripts/generate-aptor-proof.mjs"
"$snarkjs_bin" groth16 verify \
  "$workspace_dir/build/aptor/verification_key.json" \
  "$workspace_dir/proofs/aptor/latest/public.json" \
  "$workspace_dir/proofs/aptor/latest/proof.json"

for fixture in experience skill rating production; do
  if node "$workspace_dir/scripts/generate-aptor-proof.mjs" \
    "$workspace_dir/inputs/aptor-invalid-$fixture.json" \
    "$workspace_dir/proofs/aptor/invalid-$fixture" >/dev/null 2>&1; then
    echo "Invalid $fixture fixture unexpectedly produced a proof" >&2
    exit 1
  fi
  echo "Invalid $fixture fixture rejected by circuit constraints"
done
