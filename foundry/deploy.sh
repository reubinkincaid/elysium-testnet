#!/usr/bin/env bash
# Deploy both contracts to Elysium testnet and verify on-chain.
#   ./foundry/deploy.sh
#
# Reads the key from the repo .env (never echoed). Fails closed if the
# balance is too low to cover the deployment.
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
PK="$ELYSIUM_TESTNET_KEY"
ADDR=$(cast wallet address --private-key "$PK")
echo "deployer  $ADDR"
echo "balance   $(cast balance "$ADDR" --rpc-url "$RPC" | awk '{print $1/1e18}') HYPE"
echo

# 1,000,000 EST initial supply; 1 EST/sec across the whole supply.
echo "=== ElysiumStreamingToken ==="
EST=$(forge create src/ElysiumStreamingToken.sol:ElysiumStreamingToken \
  --rpc-url "$RPC" --private-key "$PK" \
  --broadcast \
  --constructor-args 1000000000000000000000000 1000000000000000000 "$ADDR" \
  2>&1 | tee /tmp/est_deploy.log | grep -oE '0x[a-fA-F0-9]{40}' | tail -1)
echo "address   $EST"
grep -E 'transactionHash|gas used|block' /tmp/est_deploy.log | head -4

echo
echo "=== ElysiumQuoteBook (5s min interval) ==="
EQB=$(forge create src/ElysiumQuoteBook.sol:ElysiumQuoteBook \
  --rpc-url "$RPC" --private-key "$PK" \
  --broadcast \
  --constructor-args 5 \
  2>&1 | tee /tmp/eqb_deploy.log | grep -oE '0x[a-fA-F0-9]{40}' | tail -1)
echo "address   $EQB"
grep -E 'transactionHash|gas used|block' /tmp/eqb_deploy.log | head -4

echo
echo "=== on-chain verification ==="
cast call "$EST" "name()(string)" --rpc-url "$RPC"
cast call "$EST" "symbol()(string)" --rpc-url "$RPC"
cast call "$EST" "totalSupply()(uint256)" --rpc-url "$RPC"
cast call "$EQB" "minInterval()(uint256)" --rpc-url "$RPC"
echo "code EST  $(cast code "$EST" --rpc-url "$RPC" | wc -c | tr -d ' ') chars"
echo "code EQB  $(cast code "$EQB" --rpc-url "$RPC" | wc -c | tr -d ' ') chars"

cat > deployed.json <<JSON
{
  "network": "elysium-testnet",
  "chainId": 99801,
  "deployer": "$ADDR",
  "ElysiumStreamingToken": "$EST",
  "ElysiumQuoteBook": "$EQB"
}
JSON
echo
echo "wrote deployed.json"
