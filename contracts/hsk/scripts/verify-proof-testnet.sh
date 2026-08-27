#!/usr/bin/env bash
set -euo pipefail

: "${HSK_TESTNET_RPC_URL:?Set HSK_TESTNET_RPC_URL}"
: "${HSK_DEPLOYER_PRIVATE_KEY:?Set HSK_DEPLOYER_PRIVATE_KEY without committing it}"
: "${HSK_VERIFIER_ADDRESS:?Set the deployed verifier address}"

repo_dir="$(cd "$(dirname "$0")/../../.." && pwd)"
mapfile -t proof_args < "$repo_dir/packages/zk-hsk/proofs/latest/solidity-args.txt"
if [[ "${#proof_args[@]}" -ne 4 ]]; then
  echo "Expected four Solidity proof arguments" >&2
  exit 1
fi

cast send "$HSK_VERIFIER_ADDRESS" \
  "verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[1])" \
  "${proof_args[@]}" \
  --rpc-url "$HSK_TESTNET_RPC_URL" \
  --private-key "$HSK_DEPLOYER_PRIVATE_KEY"
