#!/usr/bin/env bash
set -euo pipefail

: "${HSK_TESTNET_RPC_URL:?Set HSK_TESTNET_RPC_URL}"
: "${HSK_DEPLOYER_PRIVATE_KEY:?Set HSK_DEPLOYER_PRIVATE_KEY without committing it}"

contract_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$contract_dir"

chain_id="$(cast chain-id --rpc-url "$HSK_TESTNET_RPC_URL")"
if [[ "$chain_id" != "133" ]]; then
  echo "Refusing deployment: expected HSK testnet chain ID 133, received $chain_id" >&2
  exit 1
fi

forge create src/ExperienceThresholdVerifier.sol:Groth16Verifier \
  --rpc-url "$HSK_TESTNET_RPC_URL" \
  --private-key "$HSK_DEPLOYER_PRIVATE_KEY" \
  --broadcast
