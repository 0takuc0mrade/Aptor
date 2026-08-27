#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "$0")/.." && pwd)"
repo_dir="$(cd "$workspace_dir/../.." && pwd)"
build_dir="$workspace_dir/build/aptor"
ptau_dir="$workspace_dir/ptau"
snarkjs_bin="$repo_dir/node_modules/.bin/snarkjs"

mkdir -p "$build_dir" "$ptau_dir" "$repo_dir/contracts/hsk/src"

circom "$workspace_dir/circuits/AptorCredential.circom" \
  --r1cs --wasm --sym \
  -l "$repo_dir/node_modules" \
  -o "$build_dir"

if [[ ! -f "$ptau_dir/pot12_final.ptau" ]]; then
  echo "Run the Phase 1 canary build first to create the development Powers of Tau" >&2
  exit 1
fi

if [[ ! -f "$build_dir/aptor_final.zkey" ]]; then
  "$snarkjs_bin" groth16 setup "$build_dir/AptorCredential.r1cs" "$ptau_dir/pot12_final.ptau" "$build_dir/aptor_0000.zkey"
  "$snarkjs_bin" zkey contribute "$build_dir/aptor_0000.zkey" "$build_dir/aptor_final.zkey" \
    --name="Aptor HSK credential contribution" -e="aptor-hsk-credential-phase-2"
fi

"$snarkjs_bin" zkey export verificationkey "$build_dir/aptor_final.zkey" "$build_dir/verification_key.json"
"$snarkjs_bin" zkey export solidityverifier "$build_dir/aptor_final.zkey" "$repo_dir/contracts/hsk/src/AptorCredentialVerifier.sol"
sed -i 's/contract Groth16Verifier/contract AptorCredentialGroth16Verifier/' "$repo_dir/contracts/hsk/src/AptorCredentialVerifier.sol"
