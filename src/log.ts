/**
 * Block-time logger — appends one CSV row per run.
 *
 *   bun run log                  # append a row to data/blocktime.csv
 *   bun run log --json           # print the row as JSON instead of appending
 *   bun run log --local          # append to data/blocktime.local.csv (gitignored)
 *
 * The CSV is committed to git, so the history of the measurement IS the
 * artifact. That matters because the question — does Elysium converge on its
 * documented 100-200ms blocks, or not — is answered by a trend, and a trend
 * needs samples spread over weeks rather than one number.
 *
 * What is measured, and why each field:
 *
 *   blockTimeMs   the headline. Derived from chain timestamps across a window
 *                 of blocks, not wall clock, so RPC latency does not pollute it.
 *   p50/p95       block time is noisy. A single mean hides the tail, and the
 *                 tail is what a strategy actually has to survive.
 *   blocksPerSec  reciprocal of the above; the docs' framing unit.
 *   gasUsedPct    how full the chain is. Near-zero makes every other number
 *                 here look healthy for reasons that have nothing to do with
 *                 the chain's real capacity.
 *   baseFeeWei    0.01 gwei flat today. If it ever starts moving, congestion
 *                 pricing is live and the economics model needs re-running.
 *
 * Scheduling note: run this OFF the top of the hour and away from 13:30 UTC
 * (09:30 America/New_York). GitHub Actions delays scheduled runs under high
 * load, and the load peak is the US equity open — every trading workflow in
 * the world fires at once. The measurement does not care what minute it runs
 * at, so pick a quiet one.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLAIMS, CONDUIT_RPC, hasConduitKey, redactKey } from "./config.ts";

const WINDOW_BLOCKS = 200; // how many blocks to derive block time across

const asJson = process.argv.includes("--json");
const asLocal = process.argv.includes("--local");
const CSV = asLocal ? "blocktime.local.csv" : "blocktime.csv";
const OUT = join(import.meta.dir, "..", "data", CSV);

interface Block {
  number: number;
  timestamp: number;
  gasUsed: number;
  gasLimit: number;
  baseFee: bigint;
  txCount: number;
}

async function getBlock(n: number | "latest"): Promise<Block | null> {
  const res = await fetch(CONDUIT_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBlockByNumber",
      params: [typeof n === "number" ? `0x${n.toString(16)}` : n, true],
    }),
  });
  const { result, error } = (await res.json()) as {
    result?: Record<string, unknown>;
    error?: { message: string };
  };
  if (error || !result) return null;
  const txs = result.transactions as unknown;
  return {
    number: parseInt(result.number as string, 16),
    timestamp: parseInt(result.timestamp as string, 16),
    gasUsed: parseInt(result.gasUsed as string, 16),
    gasLimit: parseInt(result.gasLimit as string, 16),
    baseFee: BigInt(result.baseFeePerGas as string),
    txCount: Array.isArray(txs) ? txs.length : 0,
  };
}

const HEAD = "ts,block,blockTimeMs,blocksPerSec,ticksPerSec,gasUsedPct,baseFeeWei,txPerBlock";

async function main() {
  const latest = await getBlock("latest");
  if (!latest) {
    console.error("error: could not read latest block from", redactKey(CONDUIT_RPC));
    process.exit(1);
  }

  // Walk back a window of blocks. Use full blocks (with txs) so tx counts
  // are real, but this is a lot of calls — keep the window modest.
  const first = latest.number - WINDOW_BLOCKS;
  if (first < 1) {
    console.error("error: chain too short for a window that size");
    process.exit(1);
  }
  const from = await getBlock(first);
  if (!from) {
    console.error("error: could not read window start block");
    process.exit(1);
  }

  const chainSeconds = latest.timestamp - from.timestamp;
  const blocks = latest.number - from.number;
  if (blocks <= 0 || chainSeconds <= 0) {
    console.error("error: window had no elapsed chain time");
    process.exit(1);
  }

  // The docs advertise 100-200ms blocks, but the chain's own timestamps have
  // ~1 second granularity: consecutive block numbers routinely share a
  // timestamp, because Nitro emits several blocks per parent-chain tick. So
  // per-block gaps are mostly 0 with occasional ~1000ms jumps, and a p50 over
  // them is meaningless (it is 0) while a p95 is misleading (it is ~1000).
  //
  // What is actually meaningful is blocks per unit of chain time — the
  // aggregate rate — and the distinct-timestamp rate, which is how many
  // "clock ticks" the chain produced per second. Report both rather than a
  // per-block gap distribution that cannot mean what it appears to mean.
  const blocksPerSec = blocks / chainSeconds;

  // Count distinct timestamps in the window to get the tick rate.
  const SAMPLE = 60;
  const stamps = new Set<number>();
  for (let i = 0; i < SAMPLE; i++) {
    const b = await getBlock(first + i);
    if (b) stamps.add(b.timestamp);
  }
  const tickRate = stamps.size / (SAMPLE - 1);

  const gasPct = (latest.gasUsed / latest.gasLimit) * 100;
  const row = {
    ts: new Date().toISOString(),
    block: latest.number,
    blockTimeMs: (1000 / blocksPerSec).toFixed(1),
    blocksPerSec: blocksPerSec.toFixed(3),
    ticksPerSec: tickRate.toFixed(3),
    gasUsedPct: gasPct.toExponential(3),
    baseFeeWei: latest.baseFee.toString(),
    txPerBlock: latest.txCount.toFixed(1),
  };

  const line = [
    row.ts, row.block, row.blockTimeMs, row.blocksPerSec, row.ticksPerSec,
    row.gasUsedPct, row.baseFeeWei, row.txPerBlock,
  ].join(",");

  if (asJson) {
    console.log(JSON.stringify(row, null, 2));
    return;
  }

  if (!existsSync(OUT)) {
    mkdirSync(join(import.meta.dir, "..", "data"), { recursive: true });
    writeFileSync(OUT, HEAD + "\n");
  }
  appendFileSync(OUT, line + "\n");

  // A one-line summary is what the workflow log will show, so a bad sample is
  // visible without opening the CSV.
  const claim = CLAIMS.blockTimeMs;
  const blockTimeMs = 1000 / blocksPerSec;
  const ratio = blockTimeMs / claim.max;
  const verdict =
    blockTimeMs >= claim.min && blockTimeMs <= claim.max
      ? "within documented range"
      : `${ratio.toFixed(1)}x the documented max (${claim.min}-${claim.max}ms)`;

  console.log(`appended -> data/${CSV}`);
  console.log(`  head        ${latest.number.toLocaleString("en-US")}`);
  console.log(`  block time  ${blockTimeMs.toFixed(0)}ms aggregate  ${verdict}`);
  console.log(`  block rate  ${blocksPerSec.toFixed(2)}/s over ${blocks} blocks / ${chainSeconds}s`);
  console.log(`  tick rate   ${tickRate.toFixed(2)}/s  (distinct timestamps — chain has ~1s granularity,`);
  console.log(`               so several blocks share one timestamp; per-block gaps are 0 or ~1000ms)`);
  console.log(`  gas used    ${gasPct.toExponential(2)}% of limit`);
  console.log(`  baseFee     ${latest.baseFee} wei`);
  if (!hasConduitKey) console.log("  (no Conduit key — using the unauthenticated endpoint)");
}

await main();
