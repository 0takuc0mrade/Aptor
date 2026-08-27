#!/usr/bin/env bash
set -euo pipefail

: "${HSK_RPC_URL:?Set HSK_RPC_URL}"
: "${HSK_EXPECTED_CHAIN_ID:?Set HSK_EXPECTED_CHAIN_ID}"
: "${HSK_ADMIN_PRIVATE_KEY:?Set HSK_ADMIN_PRIVATE_KEY}"
: "${HSK_ISSUER_PRIVATE_KEY:?Set HSK_ISSUER_PRIVATE_KEY}"
: "${HSK_VERIFIER_PRIVATE_KEY:?Set HSK_VERIFIER_PRIVATE_KEY}"
: "${HSK_HOLDER_PRIVATE_KEY:?Set HSK_HOLDER_PRIVATE_KEY}"
: "${APTOR_REGISTRY_ADDRESS:?Set APTOR_REGISTRY_ADDRESS}"
: "${APTOR_REQUESTS_ADDRESS:?Set APTOR_REQUESTS_ADDRESS}"
: "${APTOR_ISSUER_ADDRESS:?Set APTOR_ISSUER_ADDRESS}"

actual_chain_id="$(cast chain-id --rpc-url "$HSK_RPC_URL")"
if [[ "$actual_chain_id" != "$HSK_EXPECTED_CHAIN_ID" ]]; then
  echo "Refusing transactions: expected chain $HSK_EXPECTED_CHAIN_ID, received $actual_chain_id" >&2
  exit 1
fi
if [[ "$HSK_EXPECTED_CHAIN_ID" != "133" && "$HSK_EXPECTED_CHAIN_ID" != "177" ]]; then
  echo "Only HSK testnet 133 and mainnet 177 are allowed" >&2
  exit 1
fi

repo_dir="$(cd "$(dirname "$0")/../../.." && pwd)"
proof_dir="$repo_dir/packages/zk-hsk/proofs/aptor/latest"
mapfile -t proof_args < "$proof_dir/solidity-args.txt"
mapfile -t public_signals < "$proof_dir/public-signals.txt"
if [[ "${#proof_args[@]}" -ne 4 || "${#public_signals[@]}" -ne 7 ]]; then
  echo "Generate the Aptor proof before running the lifecycle" >&2
  exit 1
fi
production_required=false
if [[ "${public_signals[4]}" == "1" ]]; then production_required=true; fi

cast send "$APTOR_REGISTRY_ADDRESS" "setIssuerApproval(address,bool)" "$APTOR_ISSUER_ADDRESS" true \
  --rpc-url "$HSK_RPC_URL" --private-key "$HSK_ADMIN_PRIVATE_KEY"

cast send "$APTOR_REGISTRY_ADDRESS" "registerCredential(uint256)" "${public_signals[0]}" \
  --rpc-url "$HSK_RPC_URL" --private-key "$HSK_ISSUER_PRIVATE_KEY"

cast send "$APTOR_REQUESTS_ADDRESS" "createRequest(uint256,uint256,uint16,bool,uint16)" \
  "${public_signals[6]}" "${public_signals[2]}" "${public_signals[3]}" "$production_required" "${public_signals[5]}" \
  --rpc-url "$HSK_RPC_URL" --private-key "$HSK_VERIFIER_PRIVATE_KEY"

cast send "$APTOR_REQUESTS_ADDRESS" \
  "fulfillRequest(uint256,uint256,uint256,uint256[2],uint256[2][2],uint256[2])" \
  "${public_signals[6]}" "${public_signals[0]}" "${public_signals[1]}" \
  "${proof_args[0]}" "${proof_args[1]}" "${proof_args[2]}" \
  --rpc-url "$HSK_RPC_URL" --private-key "$HSK_HOLDER_PRIVATE_KEY"

cast call "$APTOR_REQUESTS_ADDRESS" \
  "requests(uint256)(address,uint256,uint16,bool,uint16,bool,bool)" "${public_signals[6]}" \
  --rpc-url "$HSK_RPC_URL"
