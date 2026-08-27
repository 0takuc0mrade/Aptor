#!/usr/bin/env bash
set -euo pipefail

: "${HSK_RPC_URL:?Set HSK_RPC_URL}"
: "${APTOR_REQUESTS_ADDRESS:?Set APTOR_REQUESTS_ADDRESS}"
: "${APTOR_REQUEST_ID:?Set APTOR_REQUEST_ID}"

cast call "$APTOR_REQUESTS_ADDRESS" \
  "requests(uint256)(address,uint256,uint16,bool,uint16,bool,bool)" "$APTOR_REQUEST_ID" \
  --rpc-url "$HSK_RPC_URL"
