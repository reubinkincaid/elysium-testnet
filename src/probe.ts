/**
 * One-shot health probe. Run this first to confirm the chain is sane.
 *
 *   bun run probe
 */
import { ELYSIUM_TESTNET, ADDRESSES, NOT_YET_LIVE, DEFAULT_RPC } from "./config.ts";

const url = DEFAULT_RPC;

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const { result, error } = (await res.json()) as { result?: T; error?: { message: string } };
  if (error) throw new Error(error.message);
  return result as T;
}

const hex = (v: string) => parseInt(v, 16);

console.log(`Elysium testnet probe — ${new Date().toISOString()}\n`);

const chainId = hex(await rpc<string>("eth_chainId"));
const height = hex(await rpc<string>("eth_blockNumber"));
const gasPrice = hex(await rpc<string>("eth_gasPrice"));
const client = await rpc<string>("web3_clientVersion");

console.log("chain");
console.log(`  chainId    ${chainId} ${chainId === ELYSIUM_TESTNET.chainId ? "OK" : "MISMATCH"}`);
console.log(`  head       ${height.toLocaleString("en-US")}`);
console.log(`  gasPrice   ${gasPrice} wei (${gasPrice / 1e9} gwei)`);
console.log(`  client     ${client}`);

console.log("\ndocumented contracts");
for (const [name, info] of Object.entries(ADDRESSES)) {
  if (info.rpc !== "elysium") {
    console.log(`  ${name.padEnd(18)} ${info.address}  on ${info.chain} — skipped (not on this RPC)`);
    continue;
  }
  try {
    const code = await rpc<string>("eth_getCode", [info.address, "latest"]);
    const size = Math.max(0, (code.length - 2) / 2);
    console.log(`  ${name.padEnd(18)} ${info.address}  ${size > 0 ? `${size}B deployed` : "NO CODE"}`);
  } catch (err) {
    console.log(`  ${name.padEnd(18)} ${info.address}  ERROR ${(err as Error).message}`);
  }
}
console.log(`\n  (the three ${"HyperEVM"} contracts are on chain 998, not 99801)`);

console.log("\nnot live on testnet yet (ArbOS upgrade ~4 weeks AFTER mainnet)");
for (const [k, v] of Object.entries(NOT_YET_LIVE)) {
  console.log(`  ${k}`);
  console.log(`    ${v}`);
}
console.log("\nAnything needing HyperCore orderbook reads or order placement on-chain");
console.log("cannot be built or tested right now. Plan around that.");
