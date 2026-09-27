/**
 * Probe the Elysium <-> HyperEVM bridge stack and report what actually works.
 *
 *   bun run bridge
 *
 * Read-only. No keys, no transactions. This answers the question the repo
 * has been carrying as an open item: can the two bridge directions be
 * exercised end to end on testnet today, and what does the retryable leg
 * actually require?
 */
import { createPublicClient, http, parseAbi, getAddress, type Address } from "viem";
import { ELYSIUM_TESTNET, ADDRESSES, CONDUIT_RPC, hasConduitKey } from "./config.ts";

const elysium = createPublicClient({ transport: http(CONDUIT_RPC) });
const hyperEvm = createPublicClient({
  transport: http(ELYSIUM_TESTNET.parentChain.rpc),
});

/** Nitro L2GatewayRouter: the route keying and token-address math. */
const ROUTER_ABI = parseAbi([
  "function getGateway(address token) view returns (address)",
  "function calculateL2TokenAddress(address l1Token) view returns (address)",
  "function calculateL1TokenAddress(address l2Token) view returns (address)",
  "function getGatewayImplementation() view returns (address)",
]);

/** Nitro retryable ticket: deposit in, redeem on L2. */
const RETRYABLE_ABI = parseAbi([
  "function depositRetryable(address to, address l1Token, uint256 amount, uint256 maxGas, uint256 gasPriceBid, address excessTo, bytes calldata data) payable",
  "function redeem(bytes32 ticketId) returns (bytes32)",
  "function getMessageStatus(bytes32 ticketId) view returns (uint8)",
]);

/** Ticket status codes, per Nitro. */
const STATUS = ["NOT_DEPOSITED", "QUEUED", "REDEEMABLE", "REDEEMED", "FAILED"] as const;

const ok = (s: boolean) => (s ? "OK" : "MISMATCH");

console.log(`# Elysium bridge — ${new Date().toISOString()}\n`);
console.log(
  `parent chain ${ELYSIUM_TESTNET.parentChain.name} (${ELYSIUM_TESTNET.parentChain.chainId}) ` +
    `via ${hasConduitKey ? "Conduit key" : "Kinetiq public RPC"}\n`,
);

// ---------------------------------------------------------------- route math
console.log("## L2GatewayRouter route math (Elysium side)");

const router = ADDRESSES.routerElysium.address as Address;
const NATIVE = "0x0000000000000000000000000000000000000000" as Address;

const gateway = await elysium.readContract({
  address: router,
  abi: ROUTER_ABI,
  functionName: "getGateway",
  args: [NATIVE],
});
const l2Native = await elysium.readContract({
  address: router,
  abi: ROUTER_ABI,
  functionName: "calculateL2TokenAddress",
  args: [NATIVE],
});
const impl = await elysium
  .readContract({ address: router, abi: ROUTER_ABI, functionName: "getGatewayImplementation" })
  .catch(() => null);

console.log(`  getGateway(0x0)                       ${gateway}`);
console.log(`  calculateL2TokenAddress(0x0)          ${l2Native}`);
if (impl) console.log(`  getGatewayImplementation()             ${impl}`);

// The gateway is a proxy: the implementation carries the real logic.
const gatewayImpl = impl ?? gateway;
const code = (await elysium.getCode({ address: gatewayImpl })) ?? "0x";
console.log(`  implementation bytecode                ${Math.max(0, (code.length - 2) / 2)}B`);

// ------------------------------------------------- deposit -> redeem surface
console.log("\n## retryable surface (HyperEVM -> Elysium)");

const L1ROUTER = ADDRESSES.routerHyperEvm.address as Address;
const l1code = (await hyperEvm.getCode({ address: L1ROUTER })) ?? "0x";
console.log(
  `  L1GatewayRouter ${L1ROUTER}\n    on parent: ${Math.max(0, (l1code.length - 2) / 2)}B ` +
    `${l1code === "0x" ? "— NOT DEPLOYED" : ok(true)}`,
);

const l1Impl = await hyperEvm
  .readContract({ address: L1ROUTER, abi: ROUTER_ABI, functionName: "getGatewayImplementation" })
  .catch(() => null);
if (l1Impl) console.log(`  L1 gateway implementation              ${l1Impl}`);

const l1native = await hyperEvm
  .readContract({ address: L1ROUTER, abi: ROUTER_ABI, functionName: "calculateL2TokenAddress", args: [NATIVE] })
  .catch(() => null);
if (l1native) {
  const match = String(l1native).toLowerCase() === String(l2Native).toLowerCase();
  console.log(
    `  parent calc L2 addr for 0x0            ${l1native}\n` +
      `  cross-check vs Elysium                 ${ok(match)}`,
  );
}

// The RetryableTicketer is a separate contract from the gateway router, and
// it is NOT published in the Elysium docs. It could not be recovered here:
// HyperEVM testnet carries almost no traffic, so there is no deposit to
// trace. Rather than guess an address, resolve it from the Elysium side,
// where Nitro mirrors the parent's retryable surface.
//
// `0x00000000000000000000000000000000000000E5` is the Arbitrum
// `RetryableTicketer` predeploy address on L2. Probe it; if it has no code,
// the retryable surface is genuinely absent and must be published at launch.
const RETRYABLE_PREDEPLOY = "0x00000000000000000000000000000000000000E5" as Address;
const retryableCode = (await elysium.getCode({ address: RETRYABLE_PREDEPLOY })) ?? "0x";
const hasRetryable = retryableCode !== "0x";

console.log(`  RetryableTicketer (Arb predeploy)     ${RETRYABLE_PREDEPLOY}`);
console.log(`    on Elysium                         ${hasRetryable ? `${(retryableCode.length - 2) / 2}B deployed` : "NO CODE — not deployed on testnet"}`);

if (hasRetryable) {
  const status = await elysium
    .readContract({
      address: RETRYABLE_PREDEPLOY,
      abi: RETRYABLE_ABI,
      functionName: "getMessageStatus",
      args: [`0x${"00".repeat(32)}`],
    })
    .then((s) => STATUS[Number(s)] ?? `code ${s}`)
    .catch((e: Error) => `call failed: ${e.message.slice(0, 60)}`);
  console.log(`    getMessageStatus(0x00..)           ${status} (a valid response confirms the ABI)`);
}

console.log("\n## funding path status");
console.log(`  retryable surface available          ${hasRetryable ? "YES" : "NO — blocked"}`);
if (!hasRetryable) {
  console.log("\n  The retryable ticketer is not deployed on Elysium testnet, so the");
  console.log("  HyperEVM -> Elysium leg cannot be scripted today. The site's own UI");
  console.log("  strings say funds land via a 'ticket' with an auto-delivery retry,");
  console.log("  which implies the ticketer exists server-side or on the parent only.");
  console.log("  Resolve the real address at mainnet, or from the Kinetiq team, before");
  console.log("  writing any unattended funding loop. Do not hardcode a guess.");
}
