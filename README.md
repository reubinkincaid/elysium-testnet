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
bun run log         # append one row to data/blocktime.csv
bun run log:summary # trend the committed series
bun run feed        # consume the Conduit sequencer feed
bun run bridge      # bridge route math + retryable surface, both chains
bun run wallet      # testnet key: generate/load, show balances on both chains
bun run economics   # price blockspace: cost per tx shape, 25% builder share
bun run universe    # which assets exist on both Elysium and HyperCore
```

Override endpoints with `ELYSIUM_RPC` / `ELYSIUM_FEED`. Bun auto-loads `.env`,
so no dotenv dependency is needed.

## Secret protection

`.env` holds three live credentials (Conduit, 0xArchive, and the testnet wallet
key) and is gitignored. A **pre-commit hook** blocks them from entering history
in two independent layers:

1. **Exact match** against the real values in `.env`. Strongest layer — reads
   the actual secrets and greps the staged diff for them, so an accidental paste
   of a key the hook has never seen is still caught. A regex cannot do this
   reliably for an unknown 64-char string.
2. **gitleaks** for generic provider patterns (GitHub PATs, Slack webhooks,
   private-key blocks) — catches secrets from sources layer 1 has never seen.

Plus a guard that refuses to commit `.env` or any `*.key` / `*.pem`.

```bash
./scripts/install-hooks.sh     # after a fresh clone
```

`.git/hooks` is not version-controlled, so the hook is tracked at
`scripts/pre-commit-hook` and copied into place. Needs `brew install gitleaks`
for layer 2; layer 1 works without it.

**Verified** against: each of the three real `.env` keys, a GitHub PAT, a Slack
webhook, and a staged `.env` — all blocked; a clean file, an empty stage, and an
`.env.example`-only change — all allowed. A key staged *alongside* an
`.env.example` edit is still blocked, so the template exemption cannot be used
to smuggle one through.

`.gitleaks.toml` allowlists `.env.example` from the generic api-key rule, which
otherwise matches across its comment block. Do not widen that allowlist to make
a scan pass.

## Wallet hygiene

**One address, kept for the whole period, with its key stored safely.** That is
the whole rule.

`0xa50a2F34Fbbead8DeFC22963Dc77b77EE91B8D2E` is the Elysium testnet address:
it deployed both contracts and holds all testnet activity. Eligibility for any
future distribution attaches to the *address*, not to a key, so there is nothing
to gain by rotating — a rotated key produces the same address only if it is the
same key, and a different key means a different address, which abandons the
history rather than preserving it.

So: keep using this address for testnet work, and keep its key somewhere the
repo cannot reach. Importing the same key into a hardware wallet or password
manager does not change the address, which is the entire point.

Custody notes:

- `.env` currently holds `ELYSIUM_TESTNET_KEY` so `deploy.sh` and
  `bun run wallet` work. It is gitignored, mode 600, and verified absent from
  every commit. Once a password-manager copy exists, the `.env` copy is a
  convenience and can be removed.
- The address itself is already public (this README, `foundry/deployed.json`,
  and the chain). That is fine — addresses are public information. Only the key
  is a secret.
- The key has existed in a plaintext file on one machine. That is a real, if
  small, exposure, and is a reason to treat this as a *scored* address only if
  a distribution is actually announced — not a reason to move funds today.

**Do not create a second "airdrop" address.** An airdrop that lands on an
address is not claimable by rotating away from it. One address, one key, kept
safe.

## Data sources

| Key | Used for |
|---|---|
| `CONDUIT_API_KEY` | Conduit RPC + sequencer feed (rate limits lifted) |
| `ELYSIUM_TESTNET_KEY` | throwaway testnet key for `bun run wallet` |
| `OXARCHIVE_API_KEY` (or legacy `OX_ARCHIVE_API_KEY`) | HyperCore data via 0xArchive — Pro tier, needed for L4 channels |

None are ever printed. `.env` is gitignored and chmod 600.

**0xArchive lead over the public Hyperliquid API** (from their published
latency race, 2026-09-27, 24h windows):

```
Tokyo    494,004 matched pairs  Stream first 99.78%  p50 lead  67.5ms  p90 147.5ms
US East  493,972 matched pairs  Stream first 99.58%  p50 lead  72.5ms  p90 202.5ms
```

Payloads are 100% identical (same price, size, time, hash) — no synthesis. Tokyo
wins mainly in the tail (p90 147.5ms vs 202.5ms), which is where latency
strategy actually lives. Pro tier unlocks `l4_diffs` / `l4_orders`, which the
official feed does not provide at all.

Caveat: this measures *HyperCore → your feed*. It says nothing about the
Elysium leg, which is the slower one and the real constraint.


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

## Contracts (`foundry/`)

Two Solidity contracts, built with Foundry. Neither has an owner, a mint role,
an upgrade path, or a privileged function.

**`ElysiumStreamingToken.sol`** (OEX) — fixed 1,000,000 initial supply, then
1 OEX/sec accruing from `lastAccrual` to `block.timestamp`, distributed pro-rata
by supply share. `accrue()` is permissionless. The point is that state is
*maintained over time* rather than set once, which the other 13 Elysium testnet
tokens do not do. Streaming is only viable because blockspace is near-free here.

Name is "Open Exchange Token", symbol `OEX` — a nod to 0xArchive, whose
HyperCore L4 feed this work is built against. Deliberately not spelled `0x…`:
a symbol starting with `0x` is valid hex and the shape of a truncated address,
so naive `startsWith("0x")` parsers misread it. Checked clean against Elysium
testnet and Hyperliquid's 212 perps. Both strings are `constant`, so they are
permanent in the bytecode.

**`ElysiumQuoteBook.sol`** — two-sided quote per token with a `minInterval`
cadence dial, publishes spread in bps, and reports **staleness** rather than
pretending an unrefreshed quote is live. `tryRefresh()` never reverts, so a
keeper loop can call every block safely. No oracle and no price feed: quotes
are whatever a caller publishes, so this must not be used as a price source.

```bash
cd foundry
forge test              # 30 tests
forge build
./deploy.sh             # broadcasts to testnet — needs approval
```

**Deployed (2026-09-27):**

| | address | tx | code |
|---|---|---|---|
| `ElysiumStreamingToken` (OEX) | `0xdc5a850c1cce4e7fe6a35976763698cd554864be` | `0xf5c50e65…d7` | 2,821 B |
| `ElysiumQuoteBook` | `0xb5681268c210e14732e7c1e0a0847eef764dbc5e` | `0x567a4b58…57` | 1,898 B |

Both verified live on-chain: quote round-trip, cadence rejection, `tryRefresh`
returning false without reverting, crossed-book rejection, accrual over elapsed
time, `transfer` conserving balance, `approve`/`allowance`, and reverts on
overspend, over-allowance, and transfer-to-zero. `deployed.json` is the record.

> **Note:** the deployed bytecode predates the `EST:` → `OEX:` revert-string
> rename, so the live contract still reverts with the old prefix. The change is
> cosmetic and affects only revert data; a redeploy would pick it up.

`deploy.sh` reads `ELYSIUM_TESTNET_KEY` from the repo `.env` and derives
`0xa50a2F34Fbbead8DeFC22963Dc77b77EE91B8D2E` (the same funded key
`bun run wallet` reports). It never echoes the key, and only that one line of
`.env` is sourced. Addresses land in `foundry/deployed.json`.

`forge-std` is a git submodule, not vendored. Build artifacts
(`out/`, `cache/`, `broadcast/`) are gitignored; `src/`, `test/`,
`foundry.toml`, `deploy.sh` and `deployed.json` are committed.

**The testnet explorer has no source-verification API** (probed 2026-09-27:
`/api`, `?module=contract&action=verifysourcecode`, and `/api/v2/...` all
return 404). Deployed contracts therefore appear as unnamed `Contract` chips.
`forge verify-contract` cannot succeed, so this repo and `deployed.json` are
the source of truth for what was deployed. `deploy.sh` has a `VERIFY_API`
flag to re-probe and enable it if that ever changes.

## Cross-venue arb: feasibility, and what actually gates it

`bun run arb:feasibility` measures the decisive number rather than assuming it.

**The constraint is the Elysium leg, not the data.** Elysium's block time is
~440ms (from `data/blocktime.csv`); HyperCore's is ~70ms. An Elysium AMM quoting
against HyperCore therefore reprices ~440ms late, and that delay is the whole
window. Measured price movement inside 440ms, from trade data, last hour:

| sym | trades/s | p50 | p90 | p99 | max | taker | maker |
|---|---|---|---|---|---|---|---|
| HYPE | 1.6 | 0.00 | 1.53 | 4.59 | 4.70 | 4.00bp | **-0.10bp** |
| PURR | 1.3 | 5.99 | 15.33 | 29.91 | 43.14 | 3.50bp | **-0.30bp** |
| BTC | 3.3 | 0.12 | 0.83 | 2.13 | 2.13 | 4.32bp | **-0.10bp** |
| ETH | 1.9 | 0.37 | 3.73 | 4.47 | 4.47 | 3.50bp | **-0.10bp** |
| SOL | 0.9 | 0.81 | 3.26 | 8.14 | 9.78 | 4.00bp | +0.40bp |

All values in basis points. Fees are per-notional (price x size), measured
from actual fills — the fee is denominated in USDC, so comparing it to price
alone is wrong by orders of magnitude.

**Maker fees are negative on most perps** — a small rebate. That matters: a
passive leg costs nothing and pays you rather than taxing you.

**At an assumed 30bp AMM spread, the required dislocation is ~33.5bp.**
Nothing clears it. BTC and HYPE are 15-25x too small. PURR is the only symbol
where the tail even approaches the bar — p99 of 29.9bp against a 33.5bp
requirement, and that is 1-in-100 trades requiring you to be positioned with
inventory on both legs to catch it.

**But the spread is the dominant unknown and it is not measurable until an AMM
exists.** A thin new market quoting 200bp wide would need a 200bp move; a
competitive one at 5bp would need ~9bp, which several symbols would clear. That
single unmeasured input flips the conclusion, and it is the first thing to
measure at mainnet rather than assume.

Three things would improve the picture: a smaller block time (at 200ms the
required move roughly halves), a tighter spread, and posting passively on one
leg to collect the rebate instead of paying taker.

**Conclusion: do not build the Elysium arb executor yet.** The measurement
tool is the deliverable. Build the strategy at mainnet, against the live spread,
once there is something to quote against.

## Block-time series

`bun run log` appends one row to `data/blocktime.csv`; `bun run log:summary`
trends it. A GitHub Actions workflow runs twice a day and commits the CSV, so
the series lives in git history and the answer to "does Elysium converge on its
documented 100–200ms blocks" becomes a trend rather than an anecdote.

Scheduling is deliberate, from GitHub's documented behaviour:

- **Off the top of the hour** — the `schedule` event is delayed under high load,
  and the top of the hour is a known high-load point.
- **07:23 and 19:23 UTC** — nowhere near 13:30 UTC (09:30 New York), the US
  equity open, which is the busiest moment for Actions because every trading
  workflow fires at once. This measurement averages ~90s of chain history, so
  it is completely insensitive to *when* it runs.
- **No secrets** — it reads the public Kinetiq endpoint, not the keyed Conduit
  one, so nothing sensitive reaches the runner.
- **Free** — standard runners in public repos cost no account minutes.

Scheduled workflows in public repos auto-disable after 60 days of inactivity.
This one commits on every run, so it *is* activity and keeps itself alive. If
data stops arriving, check whether the workflow was disabled before assuming a
bug.

### What the columns mean, and one thing they don't

`blockTimeMs` is an **aggregate over a 200-block window**, not a per-block
measurement. That distinction matters: Elysium's block timestamps have ~1s
granularity and consecutive block numbers routinely share a timestamp, because
Nitro emits several blocks per parent-chain tick. A per-block gap distribution
is therefore mostly zeros with occasional ~1000ms jumps — its p50 is 0 and its
p95 is 1000, and neither number means anything. An earlier version of this
script reported exactly that and it was meaningless.

`blocksPerSec` and `ticksPerSec` are the honest primitives: blocks produced per
second, and distinct timestamps per second.

`gasUsedPct` sits around **4e-9%** of the gas limit. The chain is empty, which
makes every other number here look healthy for reasons that have nothing to do
with real capacity.

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
