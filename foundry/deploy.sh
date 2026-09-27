#!/usr/bin/env bash
# Deploy both contracts to Elysium testnet, verify source, and confirm on-chain.
#   ./deploy.sh
#   ./deploy.sh --no-verify     # skip explorer source verification
#
# Reads the key from the repo .env (never echoed). Only the ELYSIUM_TESTNET_KEY
# line is sourced, so the Conduit and 0xArchive keys never enter this shell.
set -euo pipefail

export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")"

ENV_FILE="$(cd .. && pwd)/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: no .env at $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source <(grep -E '^ELYSIUM_TESTNET_KEY=' "$ENV_FILE")
if [[ -z "${ELYSIUM_TESTNET_KEY:-}" ]]; then
  echo "error: ELYSIUM_TESTNET_KEY not set in .env (run: bun run wallet)" >&2
  exit 1
fi

RPC="https://testnet-rpc.elysium.kinetiq.xyz"
EXPLORER="https://elysium.kinetiq.xyz/testnet-explorer"
CHAIN_ID=99801
PK="$ELYSIUM_TESTNET_KEY"
ADDR=$(cast wallet address --private-key "$PK")
DO_VERIFY=1
[[ "${1:-}" == "--no-verify" ]] && DO_VERIFY=0

echo "deployer  $ADDR"
echo "balance   $(cast balance "$ADDR" --rpc-url "$RPC" | awk '{print $1/1e18}') HYPE"
echo "chainId   $CHAIN_ID"
echo

# 1,000,000 OEX initial supply; 1 OEX/sec across the whole supply.
echo "=== ElysiumStreamingToken (OEX) ==="
OEX=$(forge create src/ElysiumStreamingToken.sol:ElysiumStreamingToken \
  --rpc-url "$RPC" --private-key "$PK" \
  --broadcast \
  --constructor-args 1000000000000000000000000 1000000000000000000 "$ADDR" \
  2>&1 | tee /tmp/oex_deploy.log | grep -oE '0x[a-fA-F0-9]{40}' | tail -1)
OEX_TX=$(grep -oE '0x[a-fA-F0-9]{64}' /tmp/oex_deploy.log | head -1)
echo "address   $OEX"
echo "tx        $OEX_TX"
grep -iE 'gas|block number|transaction' /tmp/oex_deploy.log | head -3

echo
echo "=== ElysiumQuoteBook (5s min interval) ==="
EQB=$(forge create src/ElysiumQuoteBook.sol:ElysiumQuoteBook \
  --rpc-url "$RPC" --private-key "$PK" \
  --broadcast \
  --constructor-args 5 \
  2>&1 | tee /tmp/eqb_deploy.log | grep -oE '0x[a-fA-F0-9]{40}' | tail -1)
EQB_TX=$(grep -oE '0x[a-fA-F0-9]{64}' /tmp/eqb_deploy.log | head -1)
echo "address   $EQB"
echo "tx        $EQB_TX"
grep -iE 'gas|block number|transaction' /tmp/eqb_deploy.log | head -3

# ---------------------------------------------------------------- verify
# The Elysium testnet explorer exposes no verification API. Probed 2026-09-27:
#   /api                                    -> 404
#   /api?module=contract&action=verifysourcecode -> 404
#   /api/v2/smart-contracts/1               -> 404
# So `forge verify-contract` cannot succeed here, and a deployed contract
# shows as a bare "Contract" chip with no name in the UI. The repo plus
# deployed.json are the source of truth until the explorer supports it.
#
# Re-run this probe before assuming verification is available; if it ever
# starts answering, set VERIFY_API=1 here and the step below will engage.
VERIFY_API=0

VERIFIED=false
if [[ "$DO_VERIFY" == "1" && "$VERIFY_API" == "1" ]]; then
  verify_one() {
    local contract=$1 address=$2
    echo
    echo "=== verifying $contract ($address) ==="
    if forge verify-contract "$address" \
        --rpc-url "$RPC" \
        --chain "$CHAIN_ID" \
        --verifier etherscan \
        --verifier-url "$EXPLORER/api" \
        --watch 2>&1 | tail -6; then
      echo "  $contract: verified"
      return 0
    fi
    echo "  $contract: verification FAILED (contract is live regardless)" >&2
    return 1
  }
  if verify_one ElysiumStreamingToken "$OEX" && verify_one ElysiumQuoteBook "$EQB"; then
    VERIFIED=true
  fi
elif [[ "$DO_VERIFY" == "1" ]]; then
  echo
  echo "=== source verification unavailable ==="
  echo "  explorer has no verification API, so both contracts will appear"
  echo "  as unnamed 'Contract' chips. Source + addresses are in the repo."
else
  echo
  echo "=== skipping source verification (--no-verify) ==="
fi

# --------------------------------------------------------- on-chain checks
echo
echo "=== on-chain state ==="
printf "  name        %s\n" "$(cast call "$OEX" 'name()(string)' --rpc-url "$RPC")"
printf "  symbol      %s\n" "$(cast call "$OEX" 'symbol()(string)' --rpc-url "$RPC")"
printf "  decimals    %s\n" "$(cast call "$OEX" 'decimals()(uint8)' --rpc-url "$RPC")"
printf "  totalSupply %s\n" "$(cast call "$OEX" 'totalSupply()(uint256)' --rpc-url "$RPC")"
printf "  holder bal  %s\n" "$(cast call "$OEX" 'balanceOf(address)(uint256)' "$ADDR" --rpc-url "$RPC")"
printf "  minInterval %s\n" "$(cast call "$EQB" 'minInterval()(uint256)' --rpc-url "$RPC")"
printf "  code OEX    %s bytes\n" "$(( $(cast code "$OEX" --rpc-url "$RPC" | wc -c | tr -d ' ') - 2 ))"
printf "  code EQB    %s bytes\n" "$(( $(cast code "$EQB" --rpc-url "$RPC" | wc -c | tr -d ' ') - 2 ))"
printf "  nonce       %s\n" "$(cast nonce "$ADDR" --rpc-url "$RPC")"

cat > deployed.json <<JSON
{
  "network": "elysium-testnet",
  "chainId": $CHAIN_ID,
  "deployer": "$ADDR",
  "explorer": "$EXPLORER",
  "sourceVerified": $VERIFIED,
  "ElysiumStreamingToken": {
    "address": "$OEX",
    "tx": "$OEX_TX",
    "name": "Open Exchange Token",
    "symbol": "OEX"
  },
  "ElysiumQuoteBook": {
    "address": "$EQB",
    "tx": "$EQB_TX"
  }
}
JSON
echo
echo "wrote deployed.json"
echo "explorer: $EXPLORER/address/$OEX"
