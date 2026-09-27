/**
 * Blockspace economics: what does it actually cost to consume Elysium
 * blockspace, and what does the 25% builder share imply?
 *
 *   bun run economics [hours]
 *
 * The docs tune the fee environment for "5-10 quote refreshes per second".
 * This puts a number on that claim and derives the runtime budget for a
 * 1 HYPE balance. Everything here is computed from measured chain values
 * (baseFee, gas limit) plus explicit gas models — no magic constants.
 */
import { CLAIMS, CONDUIT_RPC, redactKey, hasConduitKey } from "./config.ts";

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(CONDUIT_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const { result, error } = (await res.json()) as { result?: T; error?: { message: string } };
  if (error) throw new Error(error.message);
  return result as T;
}

const hex = (v: string) => BigInt(v);

/**
 * Gas models, by what a transaction actually does. These are the shape of
 * the work, not measurements — the point is to price each shape.
 */
const SHAPES = [
  { label: "plain transfer", gas: 21_000n, note: "value only, no state" },
  { label: "counter update (warm)", gas: 22_100n, note: "SSTORE, slot already warm" },
  { label: "counter update (cold)", gas: 46_000n, note: "SSTORE, first touch of slot" },
  { label: "quote publish", gas: 50_000n, note: "SSTORE + LOG20" },
  { label: "quote refresh", gas: 85_000n, note: "SSTORE + SSTORE + LOG, the MM case" },
  { label: "AMM swap", gas: 150_000n, note: "reads + writes + event" },
] as const;

const RATES = [1, 5, 10, 50] as const;

console.log(`# Elysium blockspace economics — ${new Date().toISOString()}`);
console.log(`source: ${redactKey(CONDUIT_RPC)}${hasConduitKey ? "  (key loaded)" : ""}\n`);

// ------------------------------------------------------------------ on-chain
const [baseFeeHex, latestBlock, headHex] = await Promise.all([
  rpc<string>("eth_gasPrice"),
  rpc<{ gasLimit: string; gasUsed: string }>("eth_getBlockByNumber", ["latest", false]),
  rpc<string>("eth_blockNumber"),
]);
const baseFee = hex(baseFeeHex);
const gasLimit = hex(latestBlock.gasLimit);
const gasUsed = hex(latestBlock.gasUsed);

/**
 * Format wei as HYPE. gas * wei per tx lands around 8.5e8 wei (8.5e-10 HYPE),
 * so integer division truncates to 0 and fixed decimals hide what is left.
 * Take a Number first and use exponential whenever the fixed form rounds away.
 */
const fmt = (wei: bigint, dp = 9) => {
  const s = Number(wei) / 1e18;
  if (s === 0) return "0";
  const fixed = s.toFixed(dp);
  return Number(fixed) === 0 ? s.toExponential(2) : fixed;
};

/** Same, but avoids truncating small wei values through integer division. */
const hypes = (wei: bigint) => Number(wei) / 1e18;

console.log("## measured chain state");
console.log(`  head              ${Number(hex(headHex)).toLocaleString("en-US")}`);
// baseFee is wei; 1 gwei = 1e9 wei. Dividing wei by 1e18 gives HYPE, not gwei.
console.log(`  baseFee           ${Number(baseFee) / 1e9} gwei (${baseFee} wei)`);
console.log(`  gasLimit          ${gasLimit.toLocaleString("en-US")}`);
console.log(`  gasUsed           ${gasUsed.toLocaleString("en-US")}  (${((Number(gasUsed) / Number(gasLimit)) * 100).toFixed(6)}% of limit)`);
console.log(`  baseFee is ${baseFee === 10_000_000n ? "FLAT at 0.01 gwei — not congestion-priced" : "variable (congestion pricing is live)"}`);

// ------------------------------------------------------------- cost per shape
console.log("\n## cost per transaction, by work shape");
console.log(`  ${"shape".padEnd(24)} ${"gas".padStart(9)}  ${"HYPE/tx".padStart(13)}  ${"HYPE/hr @10Hz".padStart(15)}  note`);
for (const s of SHAPES) {
  const costWei = s.gas * baseFee;
  const perHrWei = costWei * 10n * 3600n;
  console.log(
    `  ${s.label.padEnd(24)} ${s.gas.toLocaleString("en-US").padStart(9)}  ` +
      `${hypes(costWei).toExponential(2).padStart(13)}  ${fmt(perHrWei, 6).padStart(15)}  ${s.note}`,
  );
}
console.log("  (last column is HYPE per hour at 10 refreshes/sec)")

// ------------------------------------------------------ the docs' own claim
const q = CLAIMS.quoteRefreshHz;
const midHz = Math.round((q.min + q.max) / 2);
const quoteGas = SHAPES.find((s) => s.label === "quote refresh")!.gas;
const perHrWei = quoteGas * baseFee * BigInt(midHz) * 3600n;
const perHour = hypes(perHrWei);

// "Cheap" is relative: 0.024 HYPE/hr is nothing against a 1 HYPE balance that
// lasts 40+ hours at this rate, but it is not literally zero. Judge it against
// the balance the user actually holds, not an absolute threshold.
const DAY_HYPE = hypes(quoteGas * baseFee * BigInt(midHz) * 3600n * 24n);
console.log(`\n## the docs' claim, priced`);
console.log(`  Docs tune fees for ${q.min}-${q.max} quote refreshes/sec. At ${midHz} Hz,`);
console.log(`  a ${quoteGas.toLocaleString("en-US")}-gas refresh costs ${fmt(perHrWei, 6)} HYPE/hour`);
console.log(`  = ${fmt(perHrWei * 24n, 4)} HYPE/day.`);
console.log(`  Verdict: cheap in absolute terms — it is ${(perHour * 100).toFixed(3)}% of a`);
console.log(`  1 HYPE balance per hour, so a day of quoting at ${midHz} Hz burns ${DAY_HYPE.toFixed(4)} HYPE.`);
console.log(`  The claim holds: 5-10 Hz is sustainable, not that it is free.`);

// ------------------------------------------------------- runtime for 1 HYPE
console.log(`\n## runtime per 1 HYPE, by refresh rate (quote-refresh shape)`);
for (const hz of RATES) {
  const costHrWei = quoteGas * baseFee * BigInt(hz) * 3600n;
  const costHr = Number(costHrWei) / 1e18;
  const hours = 1 / costHr;
  const human =
    hours >= 1e6 ? `${(hours / 8760).toExponential(2)} years` :
    hours >= 1e3 ? `${(hours / 24).toFixed(0)} days` :
    hours >= 1   ? `${hours.toFixed(1)} hours` :
    `${(hours * 3600).toFixed(0)} seconds`;
  console.log(
    `  ${String(hz).padStart(3)} Hz   ${fmt(costHrWei, 6).padStart(12)} HYPE/hr   ` +
      `~${human.padEnd(18)} ${hz >= q.min && hz <= q.max ? "<- in the docs' tuned band" : ""}`,
  );
}

// -------------------------------------------------- the 25% builder share
console.log(`\n## what the ${(CLAIMS.feeSplit.builders * 100).toFixed(0)}% builder share means`);
console.log("  Sequencer revenue splits " +
  Object.entries(CLAIMS.feeSplit)
    .map(([k, v]) => `${(v * 100).toFixed(0)}% ${k}`)
    .join(" / ") + ".");
console.log("");
console.log("  Two very different regimes, depending on how 'revenue' is defined:");
console.log("");
console.log("  (a) If builders are paid pro-rata on blockspace *consumed* — the 25%");
console.log("      share accrues to whoever fills blocks. At 840k of 1.1e15 gasUsed,");
console.log("      the chain is essentially empty, so the absolute amounts are tiny");
console.log("      regardless of strategy. Consuming blockspace early is about");
console.log("      establishing the position, not the revenue.");
console.log("");
console.log("  (b) If builders are paid on a *fee* basis, then the fee environment is");
console.log("      what matters, and at a flat 0.01 gwei with no congestion pricing,");
// eslint-disable-next-line no-console
  console.log("      fees cannot rise no matter how full the chain gets. The 25% share");
console.log("      would then be capped by a baseFee the chain sets to stay cheap.");
console.log("");
console.log("  Which regime applies is not published. That is the single most useful");
console.log("  unknown to resolve with the Kinetiq team — it decides whether");
console.log("  'consume blockspace' is the right objective at all.");

// ---------------------------------------------------------------- caveat
console.log(`\n## caveat`);
console.log(`  baseFee is flat and blocks are near-empty right now. Both make costs`);
console.log(`  look trivially cheap. The docs claim ${CLAIMS.throughputMgasPerSec} Mgas/s`);
console.log(`  "validated in load testing before mainnet" — this is not that load test.`);
console.log(`  Re-run under load or at mainnet before treating these numbers as`);
console.log(`  representative.`);
