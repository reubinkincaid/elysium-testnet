# Elysium testnet — measured, 2026-09-26/27

Raw observations. Regenerate any of these with the scripts in `src/`.

## Block time vs the documented claim

Docs claim 100–200ms blocks. Three independent samples:

| Window | Blocks | Measured | vs claim max |
|---|---|---|---|
| 21s | 28 | 750ms | 3.8x slower |
| 30s | 72 | 417ms | 2.1x slower |
| 20s | 32 | 594ms | 3.0x slower |

Spread is wide (417–750ms), consistent with an unloaded testnet rather than a
tuned cadence. Docs say block time "will be tuned toward the ≈100ms Nitro
floor as the chain hardens" and that the 300 Mgas/s target is "validated in
load testing before mainnet." This testnet is not that load test.

## Chain state

```
chainId      99801
head         ~386,500
gasPrice     10000000 wei (0.01 gwei)
client       nitro/vdevelopment/linux-amd64/go1.25.14
gasUsed      ~840,588 of 1,125,899,906,842,624 limit
tx rate      ~2 per block
```

`vdevelopment` in the client version string means a dev build, not a pinned
release.

## Contract deployment

Deployed on Elysium:

- `L2GatewayRouter` `0x89659883a9d980925733B0A698F117AAb65ac718` — 2202 bytes
- `ElysiumBridgeFactory` `0xb94A38a4aC46970559E89E566f2486a3Fc56BE5a` — 1876 bytes

Both are proxies (small runtime bytecode behind an implementation). Expected
for the Nitro bridge stack.

Not deployed on Elysium (they belong to HyperEVM testnet 998):

- `L1GatewayRouter` `0x1aAE2caD8B0249905492087EF230FcCEa3707C45`
- Standard gateway `0x792487eF5E423104bec94e8c58E814e5E0450cEA`
- `ElysiumMirrorFactory` `0xcaDb9986F3727177d48FA07294E1730f9D19290b`

Confirmed functional on Elysium via view calls:

- `getGateway(0x0)` → `0x30545d8b24185ddfe83e75ab6939f867b664e2e1`
- `calculateL2TokenAddress(0x0)` → `0x278ef9e593113bb354377445b30db1967bc97bad`

## Sequencer feed (Conduit relay)

20s window, `wss://relay-elysium-testnet.t.conduit.xyz/`:

```
frames            35
feed items        2,359
sequence range    384,267 .. 386,625
```

Message kinds:

| Kind | Count | Meaning |
|---|---|---|
| 3 | 2,101 | `NitroSequencerFeed` — sequenced transactions from the sequencer |
| 9 | 250 | Batch posts to the parent chain |
| 12 | 6 | unknown |
| 13 | 2 | unknown |

Senders:

| Address | Count | Role |
|---|---|---|
| `0xa4b000000000000000000073657175656e636572` | 2,101 | sequencer (ASCII `sequencer`) |
| `0x19a32faa84ac2a54aa3cfd3725b03ca256f53eb3` | 125 | batch poster A |
| `0x2bbf2cad8b0249905492087ef230fccea3708d56` | 125 | batch poster B |

The two batch posters match the two `requestId`s seen in the raw feed, and
their addresses appear as senders in ordinary Elysium blocks — so they are
also transacting on L2, not just posting batches. Worth watching whether
that is load-bearing or incidental.

Parent chain (HyperEVM) blocks touched: **219 distinct**, range
`65,355,071 .. 65,356,631`. Feed spanned 1,480s of sequenced activity, so the
relay backfills on connect rather than starting at the tip.

**Kind 9 is the settlement path.** Those are the batches whose AnyTrust DA
certificates land on HyperEVM. If you want to watch how Elysium settles,
this is the stream, not the L2 RPC.

## Wire format gotcha

The relay is **not** JSON-RPC. It does not answer `eth_chainId`. Frames are:

```json
{ "version": 1, "messages": [ { "sequenceNumber": ..., "message": { "message": { "header": {...}, "l2Msg": "..." } }, "blockHash": "0x...", "signature": null } ] }
```

Messages stream on connect in batches of a few hundred. There is nothing to
subscribe to and nothing to request.

## Endpoint latency

Single samples, not a benchmark:

| Endpoint | Latency |
|---|---|
| `testnet-rpc.elysium.kinetiq.xyz` | 377ms |
| `rpc-elysium-testnet.t.conduit.xyz` | 702ms |

Both returned identical head blocks, so they are the same chain. The
Kinetiq-hosted endpoint was faster here, but n=1 each — not a conclusion.

## Bridge lifecycle (measured 2026-09-27, `bun run bridge`)

Route math resolves on both chains and cross-checks:

```
L2 side    getGateway(0x0)                 0x30545d8b24185DdFe83E75aB6939f867b664e2E1
           calculateL2TokenAddress(0x0)    0x278eF9E593113BB354377445b30dB1967bc97baD
parent     L1GatewayRouter                 0x1aAE2caD...7C45, 2202B deployed
           calculateL2TokenAddress(0x0)    0x278eF9E5...7baD   <-- matches L2
```

**The parent RPC needs the `/evm` suffix.** `https://rpc.hyperliquid-testnet.xyz`
returns HTTP 404; `https://rpc.hyperliquid-testnet.xyz/evm` returns `0x3e6`
(998). The bare host is a different service. `config.ts` previously had the
bare host, which meant any parent-chain call failed.

**The retryable ticketer is not deployed on Elysium testnet.**
`0x00000000000000000000000000000000000000E5` (the Arbitrum `RetryableTicketer`
predeploy) has no code. It also could not be recovered by scanning HyperEVM
traffic — the parent chain is too quiet to trace a deposit. So:

- The **route math is scriptable today**.
- The **HyperEVM -> Elysium deposit leg is not**, until the ticketer address
  is published or the run is done through the web UI.
- Do **not** hardcode a guessed ticketer address. Re-run `bun run bridge`
  at mainnet and let it report.

### Faucet is deliberately not automatable

Extracted verbatim from the site's own i18n payload, not inferred:

```
"bot":      "This request looked automated. Refresh the page and try again."
"cooldown": "You've already claimed. Come back {time}."
"empty":    "The faucet is out of HYPE for now. Try again later."
```

There is **no faucet contract on Elysium**. The claim is browser-only, has
explicit bot detection and a per-address cooldown, and funds originate on
**HyperEVM testnet** before crossing. Claim once, manually. Never script it.

Faucet pays **1 HYPE** per claim (measured 2026-09-27, not the 0.1 that
other wallets' balances suggested). The claim itself is a server-side POST —
`/api/faucet/<network>` with `{address}` and no signature — but the endpoint
fingerprints the client and returns `{"error":"bot"}` to anything that is not
a real browser. Claiming is a manual browser step by design.

1 HYPE at 0.01 gwei and ~150k gas is ~**667,000 transactions**, so funding is
not a constraint on anything built here. The binding constraint is legitimacy.

## The arb universe is empty on testnet (measured 2026-09-27, `bun run universe`)

Cross-venue arb needs an asset quoted in two places. Measured:

```
HyperCore perps      234
HyperCore spot pairs 330 (316 distinct bases)
Elysium ERC-20s seen  38
Intersection         0
```

**Nothing on Elysium testnet has a HyperCore listing.** Every token observed
is `ETT` ("Elysium Test Token") or `ENFT` ("Elysium Test NFT") — and there
are *many distinct deployments of each* (14 ETT, 10+ ENFT in the sample),
which confirms the token-deployment race among the ~42 real testnet users.

Two consequences:

1. **Cross-venue arb cannot be tested on testnet.** It is a mainnet play.
   The strategy work that *is* testable now is the Elysium leg model: inject
   an assumed block time (100ms vs the measured 420–750ms) and measure how
   much spread survives execution. That needs no Elysium market data.
2. **The Elysium-only tokens are the interesting early signal** — they are
   candidates for the graduation path the docs describe (Elysium AMM →
   prop-AMM → HyperCore spot → HIP-3 perp). Watching for a bridged or
   listed one is a leading indicator.

Implementation note: 0xArchive perps return the ticker in `name`, not
`symbol`. Reading `symbol` yields an empty perp set, which is indistinguishable
from "no perps exist" — worth remembering when the numbers ever look wrong.

## What the ETT/ENFT deployers are actually doing (measured 2026-09-27)

Every Elysium ERC-20 in the sampled window is one of two contracts:

| | count | bytecode | totalSupply | decimals |
|---|---|---|---|---|
| `ETT` "Elysium Test Token" | 13 | **identical** (sha256 `d4ff51a5…`) | 1,000,000 each | 18 |
| `ENFT` "Elysium Test NFT" | 10 | **identical** (sha256 `16812902…`) | n/a (ERC-721) | — |

**All 13 ETTs are byte-for-byte the same contract, and all 10 ENFTs are the
same contract as each other.** They are not independently written — they are
one template deployed repeatedly by different wallets, with different names
that all resolve to the same literal "Elysium Test Token" / "ETT".

**None of them trade.** Across the last 5,000 blocks there were 810 Transfer
logs from 488 distinct tokens, and the 23 ETT/ENFT contracts generate **zero**
transfer activity of their own.

### Contract audit (dispatcher-level, static)

ETT exposes exactly nine functions — a **plain, complete ERC-20 and nothing
else**:

```
name()  symbol()  decimals()  totalSupply()  balanceOf()
transfer()  transferFrom()  approve()  allowance()
```

ENFT is a **stock OpenZeppelin ERC-721** (`supportsInterface(0x01ffc9a7)`,
`safeTransferFrom(0x42842e0e)`, `ownerOf(0x6352211e)`, `tokenURI`, etc.).

**Correction to an earlier reading in this file:** an initial probe suggested
`mint(address,uint256)` might be publicly callable. That was wrong. Reconstructing
the dispatcher (PUSH4 followed by EQ, rather than counting raw PUSH4 constants)
shows `0x40c10f19` is **not present** in ETT at all. Supply is fixed at
1,000,000 at construction. Neither template has a mint function, an owner, or
any access control — because there is nothing to control. The earlier result
came from calling an unknown selector, which reverts on any contract.

**There is no vulnerability to exploit.** The templates are boring and correct.
"Everyone is deploying the same buggy contract" is not what the chain shows.


**Read:** this is a deployment-count race, not a build effort. ~40 testnet
users, one tutorial or template, everyone deploying the same throwaway token
as fast as they can — presumably scoring "did you deploy a contract" under an
assumed points criterion. There is no liquidity, no secondary market, and no
attempt to make any of it trade.

Two implications for strategy:

1. **It confirms a points race is already underway** among the small user
   base, which is the competition any real build is measured against.
2. **The identical-bytecode fact does not, by itself, saturate the play.**
   Thirteen copies of one template produces thirteen near-identical artifacts.
   If the eventual criterion is a leaderboard, that ties — and a *distinct*
   contract, or one that does something the template does not, is not
   competing against the same slot. It also means there is nothing to
   exploit: the templates are correct, so the differentiator has to be
   capability, not a bug.

So the earlier claim that this play is "already saturated" was too strong.
Saturated against *another copy*; not saturated against *a different thing*.

Note also 488 distinct tokens with transfer activity chain-wide vs 38 seen in
the ERC-20 metadata sweep — most testnet tokens are unidentified by
`symbol()`, so any universe count is a lower bound.


## Blockspace economics (measured 2026-09-27, `bun run economics`)

Prices the docs' claim that fees are tuned for 5–10 quote refreshes/sec, and
prices the 25% builder share. All figures computed from measured `baseFee` and
`gasLimit`, with explicit per-shape gas models.

| shape | gas | HYPE/tx | HYPE/hr @10Hz |
|---|---|---|---|
| plain transfer | 21,000 | 2.10e-7 | 0.00756 |
| counter update (warm) | 22,100 | 2.21e-7 | 0.00796 |
| counter update (cold) | 46,000 | 4.60e-7 | 0.01656 |
| quote publish | 50,000 | 5.00e-7 | 0.01800 |
| **quote refresh** | **85,000** | **8.50e-7** | **0.03060** |
| AMM swap | 150,000 | 1.50e-6 | 0.05400 |

Runtime per 1 HYPE, quote-refresh shape:

```
  1 Hz    0.003060 HYPE/hr    ~327 hours
  5 Hz    0.015300 HYPE/hr    ~65 hours    <- docs' tuned band
 10 Hz    0.030600 HYPE/hr    ~33 hours    <- docs' tuned band
 50 Hz    0.153000 HYPE/hr    ~6.5 hours
```

**The docs' claim checks out.** At 8 Hz a refresh costs 0.0245 HYPE/hr, so a
full day of quoting burns 0.59 HYPE — sustainable, though not free. The
honest phrasing is that 5–10 Hz is *affordable*, not that it is *cheap*; an
earlier note here said "effectively free", which overstated it.

**`baseFee` is flat at 0.01 gwei and is not congestion-priced.** Blocks run
21k–840k gas against a 1.1e15 limit, i.e. under 0.000001% utilisation. So
fees cannot rise no matter how full the chain gets, which constrains what the
25% builder share can actually be worth under a fee-based interpretation.

### The open question that decides the strategy

The 25% "apps consuming blockspace" share is ambiguous in a way that matters:

- **Pro-rata on blockspace consumed** — the share accrues to whoever fills
  blocks. On a near-empty chain the absolute amounts are tiny either way, so
  the play is establishing position, not revenue.
- **Fee-based** — then the flat `baseFee` caps it, since the chain has an
  incentive to keep fees low to hit its own throughput claims.

Which one applies is not published. It is the most useful thing to ask the
Kinetiq team, alongside the retryable ticketer address and the upgrade date.

## Ecosystem snapshot

Three public repos touching the testnet as of 2026-09-26, all created within
days of launch, 0–1 stars:

- `ThePhunky1/dex-da-costa` — TypeScript, Foundry + web + Playwright, HYPE/USDC exchange
- `chekhlolz/elysium-yield-aggregator` — Solidity + Foundry, keeper runtime + dashboard
- `brunoamuniz/elysium-vs-hyperevm` — L2-vs-L1 benchmark

The yield aggregator already assumes a keeper, i.e. it is designed against
the `ElysiumCoreWriter` pattern that does not exist yet.

No SDK exists: nothing on npm or PyPI, and viem has no `99801` entry. viem's
`elysiumTestnet` is a **different chain** (id 1338, LAVA gas,
`vulcanforged.com`) — a name collision, not a match.
