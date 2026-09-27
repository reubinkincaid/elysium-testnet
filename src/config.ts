export const ELYSIUM_TESTNET = {
  chainId: 99801,
  name: "Elysium Testnet",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },

  // Documented first-party endpoint
  publicRpc: "https://testnet-rpc.elysium.kinetiq.xyz",

  // Conduit-operated endpoints. Conduit runs the sequencer for Elysium.
  conduitRpc: "https://rpc-elysium-testnet.t.conduit.xyz",
  conduitFeed: "wss://relay-elysium-testnet.t.conduit.xyz/",

  parentChain: {
    chainId: 998,
    name: "HyperEVM Testnet",
    // Parent chain for settlement + the DA certificate.
    rpc: "https://rpc.hyperliquid-testnet.xyz",
  },

  explorer: "https://elysium.kinetiq.xyz/testnet-explorer",
  faucet: "https://elysium.kinetiq.xyz/testnet-faucet",
  docs: "https://elysium.kinetiq.xyz/docs",
} as const;

/**
 * Contract addresses published in the Elysium docs for the testnet.
 * Mainnet addresses are NOT published yet.
 *
 * `chain` matters: probing a HyperEVM address against the Elysium RPC will
 * always return no code, because it is not deployed there. That is correct
 * behaviour, not a failure.
 */
export const ADDRESSES = {
  /** L2GatewayRouter on Elysium: deposits out, withdrawals in, route keying */
  routerElysium: {
    chain: "Elysium" as const,
    rpc: "elysium" as const,
    address: "0x89659883a9d980925733B0A698F117AAb65ac718",
  },
  /** L1GatewayRouter on HyperEVM testnet (998) */
  routerHyperEvm: {
    chain: "HyperEVM" as const,
    rpc: "hyperevm" as const,
    address: "0x1aAE2caD8B0249905492087EF230FcCEa3707C45",
  },
  /** Standard escrow gateway on HyperEVM testnet */
  standardGateway: {
    chain: "HyperEVM" as const,
    rpc: "hyperevm" as const,
    address: "0x792487eF5E423104bec94e8c58E814e5E0450cEA",
  },
  /** CREATE2 escrow-wallet deployer + registry, on Elysium */
  bridgeFactory: {
    chain: "Elysium" as const,
    rpc: "elysium" as const,
    address: "0xb94A38a4aC46970559E89E566f2486a3Fc56BE5a",
  },
  /** CREATE2 mirror deployer + registry, on HyperEVM testnet */
  mirrorFactory: {
    chain: "HyperEVM" as const,
    rpc: "hyperevm" as const,
    address: "0xcaDb9986F3727177d48FA07294E1730f9D19290b",
  },
} as const;

/**
 * What the docs claim, so measurements can be checked against it.
 * Source: elysium.kinetiq.xyz/docs/chain-specifications
 */
export const CLAIMS = {
  blockTimeMs: { min: 100, max: 200 },
  perceivedReceiptMs: 300,
  throughputMgasPerSec: 300,
  /** Quote refresh rate the fee environment is tuned for. */
  quoteRefreshHz: { min: 5, max: 10 },
  /** Sequencer revenue split. */
  feeSplit: { kntqBuyback: 0.5, builders: 0.25, treasury: 0.25 },
} as const;

/**
 * Elysium-specific surfaces that do NOT exist on the testnet yet.
 * Both arrive in an ArbOS network upgrade roughly four weeks AFTER mainnet.
 */
export const NOT_YET_LIVE = {
  hyperCoreDataPrecompile:
    "Reads live HyperCore orderbooks/prices/balances for call gas. Not on testnet.",
  elysiumCoreWriterPredeploy:
    "Keeper lane for placing HyperCore orders from Elysium (~100-200ms). Not on testnet.",
} as const;
