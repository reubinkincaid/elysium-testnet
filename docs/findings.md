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

Faucet drip is ~0.1 HYPE. At 0.01 gwei baseFee and ~150k gas, that is
~66,000 transactions, so funding is ample and the constraint is *legitimacy*,
not HYPE.

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
