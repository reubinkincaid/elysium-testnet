# Elysium testnet — what this is

Monitoring and research notes for Kinetiq's Elysium testnet. Not a builder
project — the goal is to understand the chain early, be positioned when
mainnet lands, and avoid paying for RPC later.

## Why Elysium matters

Kinetiq is Hyperliquid's largest liquid staking protocol. Elysium is their
L2, and it is the main new value-accrual channel for **KNTQ**:

- **50% of sequencer revenue** is programmatically spent buying KNTQ on the
  open market, then burned to the Hyperliquid Assistance Fund.
- 25% to apps consuming blockspace. 25% to treasury.

That means Elysium sequencer revenue is a *measurable* KNTQ buy-pressure
number, and it is public. Watching it is the concrete version of
"understand what Kinetiq is doing."

KNTQ context: 1B max supply, ~285M circulating, ~$0.32. **30% (300M tokens)
is still in a "protocol growth and rewards" bucket** that has not moved —
larger than everything currently circulating. That bucket is the overhang,
and any new points program would draw from it.

## Chain facts (verified 2026-09-26)

| | |
|---|---|
| Chain ID | `99801` |
| RPC | `https://testnet-rpc.elysium.kinetiq.xyz` |
| Gas | HYPE, native |
| Stack | Arbitrum Orbit (Nitro/ArbOS), **operated by Conduit** |
| Client | `nitro/vdevelopment/linux-amd64/go1.25.14` |
| Block time | **~420–600ms measured** (docs claim 100–200ms) |
| Block rate | 1.7–2.4 blocks/s |
| baseFee | 0.01 gwei, flat |
| Activity | ~2 tx/block |

Two discrepancies worth tracking, both favor skepticism:

1. **Block time is 2–3x slower than documented.** The docs say 100–200ms and
   that block time "will be tuned toward the ≈100ms Nitro floor as the chain
   hardens." At testnet launch it is not there. Whether it converges by
   mainnet is a real signal about the 300 Mgas/s throughput claim.
2. **`clientVersion` says `vdevelopment`.** A dev build, not a pinned release.

## Endpoints

Conduit runs the sequencer, and their endpoints are live and unlisted in
Kinetiq's docs:

| | |
|---|---|
| JSON-RPC | `https://rpc-elysium-testnet.t.conduit.xyz` |
| Sequencer feed | `wss://relay-elysium-testnet.t.conduit.xyz/` |

Registering at app.conduit.xyz gives **100M compute units/month free with no
rate limit**, which removes the public-endpoint problem entirely. That is
the single highest-value thing to do before mainnet — it takes minutes.

**The feed is not JSON-RPC.** Wire format is `{version, messages[]}`, and
messages stream on connect. Do not send RPC methods to it. It yields the raw
sequencer batch stream, which is the same data Conduit's own nodes consume.

Feed contents observed (20s sample): 2,101 `NitroSequencerFeed` (kind 3)
messages from the sequencer, 250 batch posts (kind 9) from **two** batch
poster addresses, 219 distinct HyperEVM parent blocks touched. Kind 9 is the
settlement path — that is where AnyTrust DA certificates land.

## What is NOT available yet

Both headline features ship in an ArbOS upgrade **~4 weeks after mainnet**,
so they cannot be built or tested now:

- **HyperCore market-data precompile** — live orderbooks, prices, balances at
  HyperCore block granularity (~70ms) for ordinary call gas.
- **`ElysiumCoreWriter` predeploy** — keeper lane for placing HyperCore orders
  from Elysium in ~100–200ms, with on-chain result callbacks.

Mainnet is targeted ~Oct 20 2026, so the upgrade lands roughly mid-November.
Any plan that depends on reading HyperCore state on-chain is blocked until
then. Plan around it.

## Testnet addresses

Deployed and confirmed on Elysium (99801):

- `L2GatewayRouter` `0x89659883a9d980925733B0A698F117AAb65ac718`
- `ElysiumBridgeFactory` `0xb94A38a4aC46970559E89E566f2486a3Fc56BE5a`

On **HyperEVM testnet (998)**, not Elysium — probing these against the Elysium
RPC correctly returns no code:

- `L1GatewayRouter` `0x1aAE2caD8B0249905492087EF230FcCEa3707C45`
- Standard gateway `0x792487eF5E423104bec94e8c58E814e5E0450cEA`
- `ElysiumMirrorFactory` `0xcaDb9986F3727177d48FA07294E1730f9D19290b`

The `HyperCoreDepositWallet` / `HyperCoreDepositFactory` family is
**pre-launch — no address published yet**. The ticker-auction, genesis, and
link ceremony are one-shot and irreversible, so read that flow now and
execute it carefully, never under time pressure.

## Usage

```bash
bun install

bun run probe       # chain health + which contracts are deployed
bun run endpoints   # compare Kinetiq vs Conduit RPC, latency
bun run blocktime   # measure block time vs the 100-200ms claim
bun run feed        # consume the Conduit sequencer feed
bun run bridge      # bridge route math + retryable surface, both chains
bun run wallet      # testnet key: generate/load, show balances on both chains
```

Override endpoints with `ELYSIUM_RPC` / `ELYSIUM_FEED`.

## Testnet wallet

`bun run wallet` generates a throwaway key into `.env` (mode 600, gitignored)
if none exists, then reports balances and nonces on **both** chains plus what
the current balance buys in transactions. The private key is never printed.
`bun run wallet --new` rotates it.

```
address  0xd2B398025B4D635b2C45Ff5CDf67606D9A2B539C
  Elysium (99801)          0.000000 HYPE   nonce 0
  HyperEVM (998)           0.000000 HYPE   nonce 0
```

**Funding is browser-only by design.** Two steps, both manual:

1. **Elysium faucet** — <https://elysium.kinetiq.xyz/testnet-faucet>. Mints
   testnet HYPE delivered to Elysium. Ships explicit bot detection
   (`"This request looked automated"`) and a per-address cooldown. Claim once,
   by hand. There is no faucet contract and none should be scripted.
2. **HyperEVM testnet faucet** — <https://app.hyperliquid-testnet.xyz/drip>,
   only if the Elysium faucet asks for parent-chain HYPE first. This one *is*
   scriptable: a single unauthenticated `claimDrip` call to
   `https://api.hyperliquid-testnet.xyz/info`. It mints **mock USDC, not
   HYPE**, so it is not a substitute for step 1.

Once funded, re-run `bun run wallet` to confirm arrival.

**Measured 2026-09-27: the faucet pays 1 HYPE, not 0.1.** The 0.1 figure
below is an estimate from other wallets' balances and was wrong by 10x.

```
address  0xa50a2F34Fbbead8DeFC22963Dc77b77EE91B8D2E
  Elysium (99801)          1.000000 HYPE   nonce 0
  HyperEVM (998)           0.000000 HYPE   nonce 0
  baseFee        0.01 gwei
  per tx         1.50e-6 HYPE
  this balance buys ~666,666 transactions
```

So funding is genuinely solved: 1 HYPE is ~667k transactions of headroom and
the faucet will not need re-claiming. The binding constraint on this chain is
legitimacy, not HYPE.

### Faucet setup: it needs a connected wallet

The faucet is a **wallet-connect page, not an address form** — there is no
field to paste into. The key has to exist in a browser wallet.

1. Read the key locally: `grep ELYSIUM_TESTNET_KEY .env` (never paste it
   anywhere, and never commit `.env`).
2. Import it into a browser wallet. **Use a dedicated wallet or a fresh
   browser profile** — this is a throwaway key, keep it away from any wallet
   holding real assets or a mainnet identity.
3. Add the Elysium testnet network. `bun run wallet` prints the exact JSON;
   `chainId` is `0x185d9` (99801). Use the **public** RPC in the wallet, not
   the keyed Conduit URL, so you are not pasting a secret into a wallet UI.
4. Open the faucet, connect, claim once.

`bun run wallet` prints this whole sequence whenever the address is unfunded,
so it is the single command to re-check status at any point.

## Not pursued

- **Self-hosted Nitro node.** Docker is not installed locally. Conduit's
  free managed tier covers the need; the repo
  `conduitxyz/conduit-arbitrum-external-node` is the path if that changes.
  Note the Elysium-specific bit: the parent chain is HyperEVM, not Ethereum,
  so the `--parent-chain.blob-client.beacon-url` flag in Arbitrum's docs does
  not apply.
- **Competing with the three existing repos** (a TS exchange, a Solidity
  yield aggregator with a keeper runtime, an L2-vs-L1 benchmark). All created
  within days of testnet launch. Not the goal here.

## Open questions

1. Will block time reach the documented 100–200ms before mainnet?
2. Does an Elysium-specific points program exist? Kinetiq's precedent is
   kPoints (weekly snapshots Tuesdays, distributions Thursdays, formula
   private), and they front-loaded 25% of KNTQ at genesis. An Elysium
   program would likely draw from the 30% rewards bucket.
3. What are the mainnet addresses, and will testnet state carry over?
4. When exactly does the ArbOS upgrade ship, and do the precompile
   addresses get published at mainnet or at the upgrade?
