/**
 * Endpoint liveness check across every RPC we know about.
 * Answers: which endpoints exist, do they agree, and how fast are they.
 */
import { ELYSIUM_TESTNET, CLAIMS, CONDUIT_RPC, hasConduitKey, redactKey } from "./config.ts";

const ENDPOINTS = [
  { label: "Kinetiq (documented)", url: ELYSIUM_TESTNET.publicRpc },
  {
    label: hasConduitKey ? "Conduit (operator, key)" : "Conduit (operator, no key)",
    url: CONDUIT_RPC,
  },
];

async function rpc(url: string, method: string, params: unknown[] = []) {
  const started = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as {
    result?: unknown;
    error?: { message?: string };
  };
  const ms = performance.now() - started;
  if (body.error) throw new Error(body.error.message ?? "rpc error");
  return { value: body.result as never, ms };
}

const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });

console.log(`# Elysium testnet endpoints — ${new Date().toISOString()}\n`);
console.log(`chainId ${ELYSIUM_TESTNET.chainId} · gas ${ELYSIUM_TESTNET.nativeCurrency.symbol}`);
console.log(
  hasConduitKey
    ? "Conduit API key loaded from .env (rate limit lifted)\n"
    : "No Conduit API key in .env — endpoints work but stay rate limited\n",
);

for (const ep of ENDPOINTS) {
  try {
    const [chain, block, version] = await Promise.all([
      rpc(ep.url, "eth_chainId"),
      rpc(ep.url, "eth_blockNumber"),
      rpc(ep.url, "web3_clientVersion"),
    ]);

    const chainId = parseInt(chain.value as string, 16);
    const height = parseInt(block.value as string, 16);
    const ok = chainId === ELYSIUM_TESTNET.chainId;

    console.log(`${ep.label}`);
    console.log(`  url         ${redactKey(ep.url)}`);
    console.log(`  chainId     ${chainId} ${ok ? "OK" : `MISMATCH (want ${ELYSIUM_TESTNET.chainId})`}`);
    console.log(`  head        ${fmt(height)}`);
    console.log(`  client      ${version.value}`);
    console.log(`  latency     ${chain.ms.toFixed(0)}ms\n`);
  } catch (err) {
    console.log(`${ep.label}`);
    console.log(`  url         ${redactKey(ep.url)}`);
    console.log(`  FAILED      ${(err as Error).message}\n`);
  }
}

console.log("Target endpoints that do not exist yet (mainnet, published at launch):");
console.log("  chainId     Coming soon");
console.log("  rpc         Coming soon");
console.log("  explorer    Coming soon");
console.log(`\nDocs claim ${CLAIMS.blockTimeMs.min}-${CLAIMS.blockTimeMs.max}ms blocks; run 'bun run blocktime' to measure.`);
