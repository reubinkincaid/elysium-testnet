/**
 * Summarise data/blocktime.csv — the answer to "is Elysium converging on its
 * documented 100-200ms blocks, or not?"
 *
 *   bun run log:summary
 *
 * Reads the committed series, so the answer is a number rather than an
 * anecdote. Intentionally dumb: no dependencies, no charting, just the trend
 * and the honest caveats.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CLAIMS } from "./config.ts";

const CSV = join(import.meta.dir, "..", "data", "blocktime.csv");

if (!existsSync(CSV)) {
  console.error("no data/blocktime.csv yet — run: bun run log");
  process.exit(1);
}

const lines = readFileSync(CSV, "utf8").trim().split("\n");
const header = lines[0].split(",");
const idx = (name: string) => header.indexOf(name);

interface Row {
  ts: string;
  block: number;
  blockTimeMs: number;
  blocksPerSec: number;
  ticksPerSec: number;
  gasUsedPct: number;
  baseFeeWei: number;
  txPerBlock: number;
}

const rows: Row[] = lines.slice(1).map((l) => {
  const c = l.split(",");
  return {
    ts: c[idx("ts")],
    block: Number(c[idx("block")]),
    blockTimeMs: Number(c[idx("blockTimeMs")]),
    blocksPerSec: Number(c[idx("blocksPerSec")]),
    ticksPerSec: Number(c[idx("ticksPerSec")]),
    gasUsedPct: Number(c[idx("gasUsedPct")]),
    baseFeeWei: Number(c[idx("baseFeeWei")]),
    txPerBlock: Number(c[idx("txPerBlock")]),
  };
});

const stat = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    mean,
    min: s[0],
    max: s[s.length - 1],
    p50: s[Math.floor(s.length * 0.5)],
    p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
  };
};

const claim = CLAIMS.blockTimeMs;
const bt = stat(rows.map((r) => r.blockTimeMs));
const rate = stat(rows.map((r) => r.blocksPerSec));

console.log(`# Block time — ${rows.length} samples`);
console.log(`  ${rows[0].ts.slice(0, 16)} .. ${rows[rows.length - 1].ts.slice(0, 16)} UTC\n`);

console.log("block time (ms, aggregate over a 200-block window)");
console.log(`  min ${bt.min.toFixed(0)}   p50 ${bt.p50.toFixed(0)}   p95 ${bt.p95.toFixed(0)}   max ${bt.max.toFixed(0)}   mean ${bt.mean.toFixed(0)}`);
console.log(`  docs claim ${claim.min}-${claim.max}ms  ->  ${(bt.mean / claim.max).toFixed(1)}x the documented max\n`);

console.log("block rate (per second)");
console.log(`  min ${rate.min.toFixed(2)}   p50 ${rate.p50.toFixed(2)}   max ${rate.max.toFixed(2)}\n`);

// Trend: compare the first third of the series against the last third, which
// is the actual question — is it moving toward the claim?
const third = Math.max(1, Math.floor(rows.length / 3));
const early = stat(rows.slice(0, third).map((r) => r.blockTimeMs));
const late = stat(rows.slice(-third).map((r) => r.blockTimeMs));
const delta = ((late.mean - early.mean) / early.mean) * 100;

console.log("trend (first third vs last third of samples)");
console.log(`  early mean ${early.mean.toFixed(0)}ms   late mean ${late.mean.toFixed(0)}ms   ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`);
if (rows.length < 6) {
  console.log("  too few samples for a trend yet — needs at least 6");
} else if (Math.abs(delta) < 15) {
  console.log("  flat: no meaningful movement toward or away from the claim");
} else if (delta < 0) {
  console.log(`  improving: ${Math.abs(delta).toFixed(0)}% faster than early samples`);
} else {
  console.log(`  REGRESSING: ${delta.toFixed(0)}% slower than early samples`);
}

const gas = stat(rows.map((r) => r.gasUsedPct));
const fees = new Set(rows.map((r) => r.baseFeeWei));
console.log("\nconditions");
console.log(`  gas used     p50 ${gas.p50.toExponential(2)}% of the 1.1e15 limit`);
console.log(`  baseFee      ${[...fees].join(", ")} wei ${fees.size === 1 ? "(flat)" : "(varies)"}`);
console.log(`  txPerBlock   p50 ${stat(rows.map((r) => r.txPerBlock)).p50.toFixed(1)}`);

console.log("\nreading this correctly");
console.log("  - Aggregate block time, not per-block gaps. The chain's timestamps");
console.log("    have ~1s granularity and several blocks share one, so a per-block");
console.log("    gap distribution is mostly zeros and means nothing.");
console.log("  - A low gas figure means the chain is empty. That makes every other");
console.log("    number here look healthy for reasons unrelated to real capacity.");
console.log("  - The docs say block time will be tuned toward ~100ms 'as the chain");
console.log("    hardens' and that 300 Mgas/s is 'validated in load testing before");
console.log("    mainnet'. This is not that load test.");
