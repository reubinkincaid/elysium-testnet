/**
 * Testnet wallet: generate or load a throwaway key, and report its balance
 * on both chains so you always know where the funds are.
 *
 *   bun run wallet            # status for the key in .env, or generate one
 *   bun run wallet --new      # force-generate a fresh key
 *
 * The private key is written to .env (gitignored) and is never printed.
 * Only the address is displayed. This is a throwaway testnet key — never
 * put value on it, and never reuse it on mainnet.
 */
import { createPublicClient, http, formatEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ELYSIUM_TESTNET, CONDUIT_RPC } from "./config.ts";

const ENV_PATH = join(homedir(), "Documents/GitHub/elysium_testnet/.env");
const FORCE_NEW = process.argv.includes("--new");

const elysium = createPublicClient({ transport: http(CONDUIT_RPC) });
const hyperEvm = createPublicClient({ transport: http(ELYSIUM_TESTNET.parentChain.rpc) });

// --------------------------------------------------------------- key handling
function readEnv(key: string): string | undefined {
  if (!existsSync(ENV_PATH)) return undefined;
  const line = readFileSync(ENV_PATH, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim() || undefined;
}

function writeEnv(key: string, value: string) {
  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const line = `${key}=${value}`;
  const next = existing.includes(`${key}=`)
    ? existing.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${existing.trimEnd()}\n${line}\n`;
  // `mode` only applies when the file is created. If .env already exists with
  // looser permissions, tighten it explicitly — writeFileSync will not.
  if (existsSync(ENV_PATH)) chmodSync(ENV_PATH, 0o600);
  writeFileSync(ENV_PATH, next, { mode: 0o600 });
}

let pk: string | undefined = readEnv("ELYSIUM_TESTNET_KEY");
const hadKey = Boolean(pk);
const generated = !pk || FORCE_NEW;

if (generated) {
  pk = generatePrivateKey();
  writeEnv("ELYSIUM_TESTNET_KEY", pk);
  console.log(
    FORCE_NEW
      ? "Generated a NEW key and overwrote the previous one in .env\n"
      : "No key found — generated one and saved to .env\n",
  );
  console.log("  The private key is NOT printed. It lives in .env (mode 600, gitignored).");
  console.log("  Throwaway testnet key only. Do not send value to it. Do not reuse on mainnet.\n");
}

const account = privateKeyToAccount(pk as `0x${string}`);
const addr = account.address;

console.log(`# Testnet wallet — ${new Date().toISOString()}\n`);
console.log(`address  ${addr}`);
console.log(`source   ${generated ? "freshly generated" : "from .env"}\n`);

// ------------------------------------------------------------------- balances
const [elyBal, parentBal, elyNonce, parentNonce] = await Promise.all([
  elysium.getBalance({ address: addr }),
  hyperEvm.getBalance({ address: addr }),
  elysium.getTransactionCount({ address: addr }),
  hyperEvm.getTransactionCount({ address: addr }),
]);

const row = (label: string, bal: bigint, nonce: number) =>
  `  ${label.padEnd(18)} ${Number(formatEther(bal)).toFixed(6).padStart(14)} HYPE   nonce ${nonce}`;

console.log("balances");
console.log(row(`Elysium (${ELYSIUM_TESTNET.chainId})`, elyBal, elyNonce));
console.log(row(`HyperEVM (${ELYSIUM_TESTNET.parentChain.chainId})`, parentBal, parentNonce));

// ------------------------------------------------------------ funding guidance
const funded = elyBal > 0n;
const fundedParent = parentBal > 0n;

console.log("\nfunding status");
if (funded) {
  console.log("  Elysium is funded. Cost per tx is ~0.0000015 HYPE at 0.01 gwei,");
  console.log("  so this balance covers a very large number of transactions.");
} else if (fundedParent) {
  console.log("  HyperEVM is funded but Elysium is not. Move it across the bridge:");
  console.log(`    ${ELYSIUM_TESTNET.explorer.replace("explorer", "testnet-bridge")}`);
  console.log("  Note: the retryable ticketer is not deployed on testnet, so the");
  console.log("  deposit leg currently only works through that web UI.");
} else {
  console.log("  Unfunded on both chains. Two steps, both browser-only by design:");
  console.log("");
  console.log("  1. Elysium faucet — mints testnet HYPE, delivered to Elysium:");
  console.log(`     ${ELYSIUM_TESTNET.faucet}`);
  console.log("     Has explicit bot detection and a per-address cooldown. Claim by");
  console.log("     hand, once. Do not script it.");
  console.log("");
  console.log("  2. If the faucet says you need HYPE on HyperEVM first, use");
  console.log("     Hyperliquid's testnet faucet: https://app.hyperliquid-testnet.xyz/drip");
  console.log("     (that one is a single unauthenticated claimDrip call, but it");
  console.log("      mints mock USDC, not HYPE)");
  console.log("");
  console.log(`  Paste this address when prompted:\n    ${addr}`);
}

// ------------------------------------------------------------- spend estimate
const TX_GAS = 150_000n;
const baseFee = await elysium.getGasPrice();
const perTxWei = baseFee * TX_GAS;
const perTx = Number(formatEther(perTxWei));

console.log("\nspend estimate");
console.log(`  baseFee        ${Number(formatEther(baseFee * 10n ** 9n))} gwei`);
console.log(`  per tx (~${TX_GAS} gas)  ${perTx.toExponential(2)} HYPE`);
if (funded) {
  console.log(`  this balance buys ~${(elyBal / perTxWei).toLocaleString("en-US")} transactions`);
}
console.log("\nGas is effectively free here. The binding constraint is legitimacy,");
console.log("not HYPE — do not treat transaction count as the objective.");
