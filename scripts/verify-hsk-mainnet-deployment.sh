#!/usr/bin/env bash

set -euo pipefail

rpc_url="${HSK_MAINNET_RPC_URL:-https://mainnet.hsk.xyz}"
expected_chain_id="0xb1"
expected_block="0x1981726"
expected_block_hash="0x14eee815ab0dc318cef10fcaed1c95bc3d24dbb778381dfe1a17e6f3aeaf307b"
expected_timestamp="0x6a9037cb"
expected_admin="0x4d313da68c5870def4c6e2989cbd178be630163a"

verifier_address="0xb4afc36f8f8b99da2175548cb2780476a544029b"
registry_address="0x0e4100f542106e0b60c918e01ce7f75df0bb79e6"
requests_address="0x296f105efa96ed3e672983bda9a2627ba39a44c0"

verifier_tx="0x4743f936c2d89e613b8ff6100ff85a50c0a9cc2a380b928b66bc708c0bf6399e"
registry_tx="0xf945fb241f16beb1ab126772e5eeb74a417093379f80f4e4219eb744b2481889"
requests_tx="0x58c0c0f666f9720137c8f74381c45593f728873e70a740915f3758f2831133c3"

for dependency in curl jq; do
  if ! command -v "$dependency" >/dev/null 2>&1; then
    echo "Missing required command: $dependency" >&2
    exit 1
  fi
done

rpc() {
  curl --fail --silent --show-error "$rpc_url" \
    -H "content-type: application/json" \
    --data "$1"
}

normalize_address() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

assert_equal() {
  local label="$1"
  local actual="$2"
  local expected="$3"

  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $label: expected $expected, received $actual" >&2
    exit 1
  fi
}

chain_id="$(rpc '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | jq -er '.result')"
assert_equal "chain ID" "$chain_id" "$expected_chain_id"
echo "PASS chain: HashKey Chain mainnet (177 / 0xb1)"

verify_deployment() {
  local name="$1"
  local address="$2"
  local transaction="$3"
  local response receipt_status receipt_block receipt_block_hash receipt_contract code code_bytes

  response="$(rpc "[{\"jsonrpc\":\"2.0\",\"method\":\"eth_getTransactionReceipt\",\"params\":[\"$transaction\"],\"id\":1},{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$address\",\"latest\"],\"id\":2}]")"
  receipt_status="$(jq -er '.[] | select(.id == 1) | .result.status' <<<"$response")"
  receipt_block="$(jq -er '.[] | select(.id == 1) | .result.blockNumber' <<<"$response")"
  receipt_block_hash="$(jq -er '.[] | select(.id == 1) | .result.blockHash' <<<"$response")"
  receipt_contract="$(jq -er '.[] | select(.id == 1) | .result.contractAddress' <<<"$response")"
  code="$(jq -er '.[] | select(.id == 2) | .result' <<<"$response")"

  assert_equal "$name receipt status" "$receipt_status" "0x1"
  assert_equal "$name deployment block" "$receipt_block" "$expected_block"
  assert_equal "$name deployment block hash" "$receipt_block_hash" "$expected_block_hash"
  assert_equal "$name created contract" "$(normalize_address "$receipt_contract")" "$address"

  if [[ "$code" == "0x" ]]; then
    echo "FAIL: $name has no runtime bytecode at $address" >&2
    exit 1
  fi

  code_bytes=$(( (${#code} - 2) / 2 ))
  echo "PASS $name: status=success address=$address runtime=${code_bytes}B"
  echo "     transaction=https://hsk.blockscout.com/tx/$transaction"
}

verify_deployment "Groth16 verifier" "$verifier_address" "$verifier_tx"
verify_deployment "Credential registry" "$registry_address" "$registry_tx"
verify_deployment "Proof requests" "$requests_address" "$requests_tx"

block_response="$(rpc "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBlockByNumber\",\"params\":[\"$expected_block\",false],\"id\":1}")"
block_hash="$(jq -er '.result.hash' <<<"$block_response")"
block_timestamp="$(jq -er '.result.timestamp' <<<"$block_response")"
assert_equal "deployment block hash" "$block_hash" "$expected_block_hash"
assert_equal "deployment timestamp" "$block_timestamp" "$expected_timestamp"
echo "PASS block: 26744614 at 2026-08-27T13:12:43Z"

getter_response="$(rpc "[{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$registry_address\",\"data\":\"0x8da5cb5b\"},\"latest\"],\"id\":1},{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$requests_address\",\"data\":\"0x7fa417b3\"},\"latest\"],\"id\":2},{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$requests_address\",\"data\":\"0xb948c3d4\"},\"latest\"],\"id\":3}]")"

registry_owner="0x$(jq -er '.[] | select(.id == 1) | .result' <<<"$getter_response" | tail -c 41)"
requests_verifier="0x$(jq -er '.[] | select(.id == 2) | .result' <<<"$getter_response" | tail -c 41)"
requests_registry="0x$(jq -er '.[] | select(.id == 3) | .result' <<<"$getter_response" | tail -c 41)"

assert_equal "registry owner" "$registry_owner" "$expected_admin"
assert_equal "request contract verifier" "$requests_verifier" "$verifier_address"
assert_equal "request contract registry" "$requests_registry" "$registry_address"
echo "PASS wiring: registry owner and request-contract dependencies match"

echo "VERIFIED: Aptor contracts are live on HashKey Chain mainnet."
