#!/usr/bin/env bash
set -euo pipefail

: "${HSK_RPC_URL:?Set HSK_RPC_URL}"
: "${HSK_EXPECTED_CHAIN_ID:?Set HSK_EXPECTED_CHAIN_ID to 133 or 177}"
: "${HSK_DEPLOYER_PRIVATE_KEY:?Set HSK_DEPLOYER_PRIVATE_KEY without committing it}"
: "${APTOR_ADMIN_ADDRESS:?Set APTOR_ADMIN_ADDRESS}"

# Foundry's envUint requires hexadecimal private keys to carry the 0x prefix,
# while common wallet export formats omit it.
case "$HSK_DEPLOYER_PRIVATE_KEY" in
  0x*) ;;
  *) export HSK_DEPLOYER_PRIVATE_KEY="0x$HSK_DEPLOYER_PRIVATE_KEY" ;;
esac

actual_chain_id="$(cast chain-id --rpc-url "$HSK_RPC_URL")"
if [[ "$actual_chain_id" != "$HSK_EXPECTED_CHAIN_ID" ]]; then
  echo "Refusing deployment: expected chain $HSK_EXPECTED_CHAIN_ID, received $actual_chain_id" >&2
  exit 1
fi
if [[ "$HSK_EXPECTED_CHAIN_ID" != "133" && "$HSK_EXPECTED_CHAIN_ID" != "177" ]]; then
  echo "Refusing deployment: only HSK testnet 133 and mainnet 177 are allowed" >&2
  exit 1
fi

contract_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$contract_dir"
forge script script/DeployAptor.s.sol:DeployAptor --rpc-url "$HSK_RPC_URL" --broadcast -vvvv
