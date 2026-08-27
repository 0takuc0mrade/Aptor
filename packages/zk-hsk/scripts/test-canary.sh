#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "$0")/.." && pwd)"
repo_dir="$(cd "$workspace_dir/../.." && pwd)"
snarkjs_bin="$repo_dir/node_modules/.bin/snarkjs"

node "$workspace_dir/scripts/generate-proof.mjs"
"$snarkjs_bin" groth16 verify \
  "$workspace_dir/build/verification_key.json" \
  "$workspace_dir/proofs/latest/public.json" \
  "$workspace_dir/proofs/latest/proof.json"

if node "$workspace_dir/scripts/generate-proof.mjs" \
  "$workspace_dir/inputs/invalid-threshold.json" \
  "$workspace_dir/proofs/invalid-threshold" >/dev/null 2>&1; then
  echo "Invalid threshold unexpectedly produced a proof" >&2
  exit 1
fi

echo "Invalid threshold rejected by circuit constraints"
