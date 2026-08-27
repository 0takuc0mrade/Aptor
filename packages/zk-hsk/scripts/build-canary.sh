#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "$0")/.." && pwd)"
repo_dir="$(cd "$workspace_dir/../.." && pwd)"
build_dir="$workspace_dir/build"
ptau_dir="$workspace_dir/ptau"
snarkjs_bin="$repo_dir/node_modules/.bin/snarkjs"

mkdir -p "$build_dir" "$ptau_dir"
mkdir -p "$repo_dir/contracts/hsk/src"

circom "$workspace_dir/circuits/ExperienceThreshold.circom" \
  --r1cs --wasm --sym \
  -l "$repo_dir/node_modules" \
  -o "$build_dir"

if [[ ! -f "$ptau_dir/pot12_final.ptau" ]]; then
  "$snarkjs_bin" powersoftau new bn128 12 "$ptau_dir/pot12_0000.ptau" -v
  "$snarkjs_bin" powersoftau contribute "$ptau_dir/pot12_0000.ptau" "$ptau_dir/pot12_0001.ptau" \
    --name="Aptor HSK canary deterministic contribution" -e="aptor-hsk-canary-phase-1"
  "$snarkjs_bin" powersoftau prepare phase2 "$ptau_dir/pot12_0001.ptau" "$ptau_dir/pot12_final.ptau" -v
fi

if [[ ! -f "$build_dir/canary_final.zkey" ]]; then
  "$snarkjs_bin" groth16 setup "$build_dir/ExperienceThreshold.r1cs" "$ptau_dir/pot12_final.ptau" "$build_dir/canary_0000.zkey"
  "$snarkjs_bin" zkey contribute "$build_dir/canary_0000.zkey" "$build_dir/canary_final.zkey" \
    --name="Aptor HSK canary circuit contribution" -e="aptor-hsk-canary-groth16-phase-1"
fi
"$snarkjs_bin" zkey export verificationkey "$build_dir/canary_final.zkey" "$build_dir/verification_key.json"
"$snarkjs_bin" zkey export solidityverifier "$build_dir/canary_final.zkey" "$repo_dir/contracts/hsk/src/ExperienceThresholdVerifier.sol"
