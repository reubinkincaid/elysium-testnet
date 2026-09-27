/**
 * Measures actual block time and tx rate, and compares against the docs.
 *
 * The docs claim 100-200ms blocks. First measurement on 2026-09-26 came in
 * around 417ms, so this is worth tracking over time rather than trusting.
 *
 *   bun run blocktime [seconds]
 */
import { CLAIMS, ELYSIUM_TESTNET } from "./config.ts";

const DURATION_S = Number(process.argv[2] ?? 30);

interface Block {
  number: number;
  timestamp: number;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
  baseFee: string;
}

async function latestBlock(url: string): Promise<Block> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: ["latest", false] }),
  });
  const { result } = (await res.json()) as { result: Record<string, unknown> };
  const txs = result.transactions as unknown;
  return {
    number: parseInt(result.number as string, 16),
    timestamp: parseInt(result.timestamp as string, 16),
    txCount: Array.isArray(txs) ? txs.length : 0,
    gasUsed: parseInt(result.gasUsed as string, 16),
    gasLimit: parseInt(result.gasLimit as string, 16),
    baseFee: result.baseFeePerGas as string,
  };
}

function stats(xs: number[]) {
  const sorted = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    mean,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

const url = process.env.ELYSIUM_RPC ?? ELYSIUM_TESTNET.publicRpc;

console.log(`# Block time over ${DURATION_S}s — ${new Date().toISOString()}`);
console.log(`source: ${url}\n`);

const start = await latestBlock(url);
const wallStart = performance.now();

await new Promise((r) => setTimeout(r, DURATION_S * 1000));

const end = await latestBlock(url);
const wallMs = performance.now() - wallStart;

const blocks = end.number - start.number;
const chainSeconds = end.timestamp - start.timestamp;
const msPerBlock = (chainSeconds / blocks) * 1000;
const txTotal = end.txCount;

const claim = CLAIMS.blockTimeMs;
const within = msPerBlock >= claim.min && msPerBlock <= claim.max;
const ratio = msPerBlock / claim.max;

console.log(`blocks        ${blocks} in ${chainSeconds}s chain time (${(wallMs / 1000).toFixed(1)}s wall)`);
console.log(`block time    ${msPerBlock.toFixed(0)}ms  (p50-ish from wall: ${(wallMs / blocks).toFixed(0)}ms)`);
console.log(`docs claim    ${claim.min}-${claim.max}ms`);
console.log(`verdict       ${within ? "within claim" : `${ratio.toFixed(1)}x slower than claimed max`}`);
console.log(`block rate    ${(blocks / chainSeconds).toFixed(2)} blocks/s`);
console.log(`gas           ${end.gasUsed} used of ${end.gasLimit} limit`);
console.log(`baseFee       ${parseInt(end.baseFee, 16)} wei (${parseInt(end.baseFee, 16) / 1e9} gwei)`);

// Sample inter-block gaps for a distribution rather than a single average.
const gaps: number[] = [];
let prev = start;
for (let i = 0; i < Math.min(blocks, 60); i++) {
  const b = await latestBlock(url);
  gaps.push((b.timestamp - prev.timestamp) * 1000);
  prev = b;
  if (b.number >= end.number) break;
}
if (gaps.length > 1) {
  const s = stats(gaps.slice(1));
  console.log(`\ngaps over ${gaps.length - 1} samples (ms):`);
  console.log(`  min ${s.min}  p50 ${s.p50}  p95 ${s.p95}  max ${s.max}  mean ${s.mean.toFixed(0)}`);
}
