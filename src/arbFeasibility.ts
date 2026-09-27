/**
 * Is cross-venue arb viable against Elysium?
 *
 *   bun run arb:feasibility
 *
 * THE decisive question is not "is the data fast enough" — it is whether
 * price moves far enough inside one Elysium block to cover the spread plus
 * fees. This measures that directly, from trade data, rather than assuming.
 *
 * The arithmetic, stated up front so the numbers mean something:
 *
 *   Elysium block time   ~440ms aggregate (see data/blocktime.csv). An
 *                        Elysium AMM quoting against HyperCore therefore
 *                        reprices ~440ms after HyperCore moves.
 *   Edge available       = price move within 440ms, MINUS the AMM spread
 *                        MINUS fees on both legs.
 *   Fees (measured)      Hyperliquid taker ~3.5-4.3bp, maker -0.0 to -0.3bp
 *                        (a small rebate). So one leg is ~3.5-4.3bp, and
 *                        if you post passively on one side the cost drops.
 *   AMM spread           unknown, and the single most important missing
 *                        input. 30bp is typical for a new/thin market.
 *
 * So break-even needs roughly (AMM spread + 4bp). At 30bp spread that is
 * ~34bp of move inside 440ms. Nothing measured comes close.
 */
import { oxGet, hasOxArchiveKey } from "./config.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Elysium block time, from the committed series, so this uses a real number. */
function elysiumBlockMs(): number {
  const p = join(import.meta.dir, "..", "data", "blocktime.csv");
  if (!existsSync(p)) return 440; // documented fallback
  const lines = readFileSync(p, "utf8").trim().split("\n").slice(1);
  const vals = lines.map((l) => Number(l.split(",")[2])).filter((n) => n > 0);
  if (!vals.length) return 440;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

interface Trade {
  coin?: string;
  price?: string | number;
  size?: string | number;
  fee?: string | number;
  fee_token?: string;
  crossed?: boolean;
  timestamp?: string | number;
  ts?: string | number;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function tsMs(t: Trade): number | null {
  const raw = t.timestamp ?? t.ts;
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return raw < 1e10 ? raw * 1000 : raw;
  const s = String(raw);
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n < 1e10 ? n * 1000 : n;
  }
  const d = Date.parse(s);
  return Number.isFinite(d) ? d : null;
}

function quantile(xs: number[], p: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

const SYMS = ["HYPE", "PURR", "BTC", "ETH", "SOL"];
const WINDOW_MS = 60 * 60 * 1000;
const ASSUMED_AMM_SPREAD_BPS = 30;

if (!hasOxArchiveKey) {
  console.error("no 0xArchive key — set OXARCHIVE_API_KEY in .env");
  process.exit(1);
}

const blockMs = elysiumBlockMs();
const horizon = Math.round(blockMs);

console.log(`# Arb feasibility — ${new Date().toISOString()}`);
console.log(`Elysium block time      ${blockMs.toFixed(0)}ms (mean of data/blocktime.csv)`);
console.log(`horizon analysed        ${horizon}ms`);
console.log(`assumed AMM spread      ${ASSUMED_AMM_SPREAD_BPS}bp  <-- UNVERIFIED, the key unknown`);
console.log(`window                  last ${WINDOW_MS / 3600000}h\n`);

const now = Date.now();
const rows: Array<{
  sym: string;
  n: number;
  perSec: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
  takerBps: number;
  makerBps: number;
}> = [];

for (const sym of SYMS) {
  let trades: Trade[] = [];
  try {
    trades = (await oxGet<Trade[]>(
      `/v1/hyperliquid/trades/${sym}?start=${now - WINDOW_MS}&end=${now}&limit=1000`,
    )) ?? [];
  } catch {
    continue;
  }

  const pts = trades
    .map((t) => ({ ts: tsMs(t), px: num(t.price) }))
    .filter((p): p is { ts: number; px: number } => p.ts !== null && p.px !== null && p.px > 0)
    .sort((a, b) => a.ts - b.ts);

  if (pts.length < 10) continue;

  // Fees in bps of notional, split taker/maker. Fee is denominated in USDC
  // and notional is price*size — comparing fee to price alone is wrong by
  // orders of magnitude and is a mistake worth not repeating.
  const takerBpsList: number[] = [];
  const makerBpsList: number[] = [];
  for (const t of trades) {
    const px = num(t.price);
    const sz = num(t.size);
    const fee = num(t.fee);
    if (px === null || sz === null || fee === null || px * sz <= 0) continue;
    const bps = (fee / (px * sz)) * 10_000;
    (t.crossed ? takerBpsList : makerBpsList).push(bps);
  }

  // Move at the horizon: for each trade, the first one at least `horizon` ms
  // later. This is the edge an Elysium AMM would leave on the table.
  const tsArr = pts.map((p) => p.ts);
  const moves: number[] = [];
  let lo = 0;
  for (let i = 0; i < pts.length; i++) {
    const target = pts[i].ts + horizon;
    if (target <= tsArr[lo]) lo = i + 1;
    let k = lo;
    while (k < tsArr.length && tsArr[k] < target) k++;
    if (k < tsArr.length) {
      moves.push((Math.abs(pts[k].px - pts[i].px) / pts[i].px) * 10_000);
    }
  }

  const span = (pts[pts.length - 1].ts - pts[0].ts) / 1000;
  rows.push({
    sym,
    n: pts.length,
    perSec: span > 0 ? pts.length / span : 0,
    p50: quantile(moves, 0.5),
    p90: quantile(moves, 0.9),
    p99: quantile(moves, 0.99),
    max: moves.length ? Math.max(...moves) : NaN,
    takerBps: takerBpsList.length ? quantile(takerBpsList, 0.5) : NaN,
    makerBps: makerBpsList.length ? quantile(makerBpsList, 0.5) : NaN,
  });
}

if (!rows.length) {
  console.error("no trade data returned — check the key and window");
  process.exit(1);
}

console.log("## price move inside one Elysium block (the edge budget)\n");
console.log(
  `  ${"sym".padEnd(6)}${"trades".padStart(7)}${"/s".padStart(7)}` +
    `${"p50".padStart(9)}${"p90".padStart(9)}${"p99".padStart(9)}${"max".padStart(10)}`,
);
for (const r of rows) {
  console.log(
    `  ${r.sym.padEnd(6)}${String(r.n).padStart(7)}${r.perSec.toFixed(1).padStart(7)}` +
      `${r.p50.toFixed(3).padStart(9)}${r.p90.toFixed(3).padStart(9)}` +
      `${r.p99.toFixed(2).padStart(9)}${r.max.toFixed(2).padStart(10)}`,
  );
}
console.log("\n  all values in basis points");

console.log("\n## fees (median, bps of notional)\n");
console.log(`  ${"sym".padEnd(6)}${"taker".padStart(9)}${"maker".padStart(10)}   note`);
for (const r of rows) {
  const note = r.makerBps < 0 ? "maker rebate" : "no rebate";
  console.log(
    `  ${r.sym.padEnd(6)}${r.takerBps.toFixed(2).padStart(9)}` +
      `${r.makerBps.toFixed(3).padStart(10)}   ${note}`,
  );
}

console.log(`\n## verdict at a ${ASSUMED_AMM_SPREAD_BPS}bp AMM spread\n`);
const required = ASSUMED_AMM_SPREAD_BPS + 3.5; // + one taker leg
console.log(`  required dislocation   ~${required.toFixed(1)}bp (spread + one taker leg)\n`);
console.log(`  ${"sym".padEnd(6)}${"p90".padStart(9)}${"p99".padStart(9)}${"p99/req".padStart(10)}   verdict`);
for (const r of rows) {
  const ratio = r.p99 / required;
  const verdict = ratio >= 1.2 ? "EDGE in the tail" : ratio >= 0.8 ? "marginal tail" : "no edge";
  console.log(
    `  ${r.sym.padEnd(6)}${r.p90.toFixed(2).padStart(9)}${r.p99.toFixed(2).padStart(9)}` +
      `${ratio.toFixed(2).padStart(10)}   ${verdict}`,
  );
}

console.log(`\n## what would change this`);
console.log("  The AMM spread is the dominant unknown and it is NOT measurable until");
console.log("  one exists. A thin market with a 200bp spread would need a 200bp move;");
console.log("  a competitive one at 5bp would need 9bp. That single input flips the");
console.log("  conclusion, and it is why the first thing to do at mainnet is measure");
console.log("  the live spread rather than assume it.");
console.log("  Second: the horizon shrinks if Elysium converges on its documented");
console.log("  100-200ms blocks. At 200ms the required move roughly halves.");
console.log("  Third: a maker-only leg pays a small rebate instead of ~3.5-4.3bp taker,");
console.log("  which lowers the bar by a few bp but requires posting passively and");
console.log("  accepting fill risk on an asset you cannot hedge atomically.");
