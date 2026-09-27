/**
 * Consumes the Conduit sequencer feed and reports what the sequencer is
 * actually doing. This is a data source Kinetiq's docs do not mention.
 *
 *   bun run feed [seconds]
 */
import WebSocket from "ws";
import { CONDUIT_FEED, hasConduitKey, redactKey } from "./config.ts";

const DURATION_S = Number(process.argv[2] ?? 20);
const url = process.env.ELYSIUM_FEED ?? CONDUIT_FEED;

interface FeedItem {
  sequenceNumber: number;
  message: {
    message: {
      header: {
        kind: number;
        sender: string;
        blockNumber: number;
        timestamp: number;
        requestId: string | null;
        baseFeeL1: number | null;
      };
      l2Msg: string;
    };
    delayedMessagesRead: number;
  };
  blockHash: string;
}

const KIND: Record<number, string> = {
  0: "UnsignedTx",
  1: "BatchPost",
  3: "NitroSequencerFeed",
  4: "SequencerMsg",
  9: "BatchPost(alt)",
};

console.log(`# Sequencer feed — ${DURATION_S}s — ${new Date().toISOString()}`);
console.log(`source: ${redactKey(url)}${hasConduitKey ? "  (key loaded)" : "  (no key)"}\n`);
console.log("Wire format is {version, messages[]}, NOT JSON-RPC. Messages arrive on");
console.log("connect and are batched, so there is no request to make. Use the https");
console.log("endpoint for JSON-RPC calls.\n");

const kinds = new Map<number, number>();
const senders = new Map<string, number>();
let items = 0;
let frames = 0;
let firstTs: number | null = null;
let lastTs: number | null = null;
let minSeq = Infinity;
let maxSeq = -Infinity;
let parentBlocks = new Set<number>();
const wallStart = performance.now();

const ws = new WebSocket(url, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });

ws.on("open", () => console.log("connected — waiting for feed frames\n"));

ws.on("message", (raw: Buffer) => {
  let parsed: { version?: number; messages?: FeedItem[] };
  try {
    parsed = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (!Array.isArray(parsed.messages)) return;
  frames++;
  for (const item of parsed.messages) {
    const h = item.message?.message?.header;
    if (!h) continue;
    items++;
    kinds.set(h.kind, (kinds.get(h.kind) ?? 0) + 1);
    senders.set(h.sender, (senders.get(h.sender) ?? 0) + 1);
    parentBlocks.add(h.blockNumber);
    if (h.timestamp) {
      firstTs ??= h.timestamp;
      lastTs = h.timestamp;
    }
    minSeq = Math.min(minSeq, item.sequenceNumber);
    maxSeq = Math.max(maxSeq, item.sequenceNumber);
  }
});

ws.on("error", (err: Error) => {
  console.error("error:", err.message);
  process.exit(1);
});

setTimeout(() => {
  const wallS = (performance.now() - wallStart) / 1000;
  ws.close();
  console.log(`frames received      ${frames}`);
  console.log(`feed items           ${items}`);
  console.log(`sequence range       ${minSeq === Infinity ? "n/a" : `${minSeq} .. ${maxSeq}`}`);
  console.log(`wall time            ${wallS.toFixed(1)}s`);

  console.log("\nkinds (message type counts):");
  for (const [k, n] of [...kinds.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  kind ${k} ${(KIND[k] ?? "unknown").padEnd(20)} ${n}`);
  }
  console.log("\nsenders (sequencer / batch poster):");
  for (const [a, n] of [...senders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`  ${a}  ${n}`);
  }
  if (parentBlocks.size) {
    const bs = [...parentBlocks].sort((a, b) => a - b);
    console.log(`\nparent chain (HyperEVM) blocks touched: ${parentBlocks.size}`);
    console.log(`  range ${bs[0]} .. ${bs[bs.length - 1]}`);
  }
  if (firstTs && lastTs && lastTs > firstTs) {
    const span = lastTs - firstTs;
    console.log(`\nfeed span            ${span}s of sequenced activity`);
    console.log(`feed rate            ${(items / span).toFixed(1)} items/s`);
  }
  console.log(
    "\nkind 9 / kind 1 are batch posts: the settlement path. AnyTrust DA",
  );
  console.log("certificates land on HyperEVM (chain 998) through these.");
  process.exit(0);
}, DURATION_S * 1000);
