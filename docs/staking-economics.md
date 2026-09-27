# What actually maximizes earnings — the sKNTQ path

Notes toward goal #2: understand the protocol well enough to earn more from
staking after Elysium goes live. Researched 2026-09-27.

## The key structural fact

KNTQ is described by Kinetiq as "the sole instrument through which all of
Kinetiq's value accrues." Every product's revenue is routed into KNTQ
buybacks, and **buybacks are sent to the sKNTQ staking contract and
distributed to sKNTQ holders.**

That is the whole thesis in one line:

```
protocol revenue ─┐
validator commissions ─┤
Markets.xyz income ─┼──> KNTQ buybacks ──> sKNTQ stakers
KNTQ trading fees ─┤
Launch revenue ─┤
Elysium sequencer (50%) ─┘
```

Elysium is not a separate bet. It is a **new revenue line feeding the same
buyback**. If Elysium generates sequencer revenue, 50% of it buys KNTQ, and
that KNTQ accrues to whoever is staked in sKNTQ. So the Elysium thesis and
the staking-earnings thesis are the same thesis.

## The tier ladder

sKNTQ = KNTQ staked. Unstaking has a **7-day withdrawal period**, so
staked position is sticky — that cuts both ways.

| Tier | sKNTQ required | Referral share | kmHYPE minting |
|---|---|---|---|
| 1 | 50,000 | 6% | up to 1,111 |
| 2 | 100,000 | 7% | up to 11,111 |
| 3 | 500,000 | 8% | up to 111,111 |
| 4 | 1,250,000 | 10% | up to 222,222 |
| 5 | 2,500,000 | 15% | ∞ (to cap) |

Two things to notice:

1. **Tier 1 costs 50,000 KNTQ.** At ~$0.32 that is ~$16k to clear the first
   tier. Not a retail entry point. Tier 5 is ~$800k.
2. **The only documented per-KNTQ benefit is the referral share** (6%→15%),
   plus kmHYPE minting allocation. The KNTQ docs also mention trading-fee
   discounts on Markets, and a kPoints multiplier for KNTQ stakers, but the
   tier table itself is referral + kmHYPE.

**Open question I could not resolve:** the docs say buybacks are distributed
to sKNTQ holders, but do not publish the per-sKNTQ yield. The tier ladder
rewards *activity* (referrals, kmHYPE minting), not *holding*. Anyone
modeling sKNTQ returns needs the buyback-distribution contract, which is not
in the public docs. That is the single most useful unknown to close.

## The Earn vault (vkHYPE)

Separate from staking. kHYPE deposited into a Veda-curated vault; you get
vkHYPE receipt tokens.

- 20% performance fee, **profit only**
- No management fee, no entry/exit fees
- Veda/Seven Seas curates; >$4b TVL across their vaults
- **"Includes principal + all accrued yield + kPoints"** — vkHYPE appreciates
  in value as kPoints accrue

The kPoints line is the interesting one: points are baked into the vault
token's value. If kPoints are worth something later, holding vkHYPE has
captured them. That is a stronger position than holding kHYPE idle.

## Where the airdrop math actually sits

KNTQ: 1B max, ~285M circulating, ~$0.32, ~$87M mcap.

- 25% already distributed (24% kPoints, 1% Hypurr)
- **30% (300M tokens) sits in "protocol growth and rewards"** — larger than
  everything currently circulating
- 23.5% contributors (1yr cliff + 2yr monthly), 7.5% investors (same)
- 10% foundation, 4% liquidity

A 300M-token bucket is the plausible source for any new program. A new
Elysium program is plausible given they front-loaded 25% at genesis and ran
recurring kPoints seasons. But it is speculation, not a known.

## Liquidity reality check (measured 2026-09-27)

KNTQ is **spot only on Hyperliquid** — there is no KNTQ perp, so no leverage
and no derivatives market to hedge or exit through. It is `tokenId 124` on
spot, and the KNTQ/USDC pair is index `@334`.

Prices at time of measurement:

| | |
|---|---|
| HYPE | $93.32 |
| 900 HYPE | ~$83,988 |
| KNTQ best bid / ask | $0.32055 / $0.32086 |
| spread | 0.097% |

**The order book is thin relative to tier size.** Full visible depth on
KNTQ/USDC:

| Side | KNTQ | USDC |
|---|---|---|
| Bids | 172,181 | ~$55,082 |
| Asks | **32,724** | **~$10,530** |

That is the real constraint, and it cuts against the plan:

- **Tier 1 (50,000 KNTQ, ~$16,045) exceeds the entire visible ask side.**
  The whole book offers only ~32,724 KNTQ. Sweeping it gets you to tier
  0.65. Buying 50,000 means pushing well past the book into whatever
  follows, at an unknown and likely much worse price.
- **Tier 5 (2,500,000 KNTQ, ~$800k) is ~76x the entire ask side.**
- Bid side is 5x deeper than ask, so exiting is easier than entering — but
  $55k of bid depth still means a 285M-token float is very thinly traded
  relative to its own supply.

**Implication:** do not size this position by the tier table. Size it by
what the book can absorb. A market buy for tier 1 is likely to fill far
worse than $0.32, and the realized entry price is unknown until you try.
Practical options:

1. **Accumulate in small clips** over time rather than sweeping.
2. **Check for other venues before buying.** Kinetiq docs mention Lit and
   Based as places to buy KNTQ — both unverified here, both may have deeper
   books. Worth checking before assuming Hyperliquid spot is the only
   option.
3. **Use limit orders only.** On a book this thin, a market order is how you
   overpay.
4. **Reconsider whether tier 1 is even the goal.** It buys a 6% referral
   share and up to 1,111 kmHYPE. That may not be worth the entry friction at
   a worse-than-quoted price.

Note this cuts against the "just buy 50k and stake" instinct. With 900 HYPE
the capital is not the binding constraint — **liquidity is.**


The "learn the protocol" path that actually pays is not the Elysium testnet.
It is:

1. **Hold sKNTQ before Elysium revenue shows up.** The buyback only pays
   sKNTQ holders. Being staked before the revenue arrives is the whole
   trade. Mind the 7-day unstake.
2. **Use vkHYPE rather than idle kHYPE** if kPoints have value — the receipt
   token accrues them.
3. **Use Elysium to sanity-check the thesis, not to farm it.** E.g. measure
   sequencer revenue, compare against the 50% buyback commitment, and watch
   whether KNTQ buy pressure actually appears. That is real research and it
   informs position sizing.

## What the testnet is actually good for

Honestly: not much for earnings. It is nearly empty (2 tx/block, ~116
senders in the last 600 blocks, no faucet contract found, no AMM). The
things worth doing:

- **Learn the bridge mechanics end to end.** The Elysium→HyperEVM→HyperCore
  lifecycle is the part that will be hard at mainnet and is fully
  documented now. Practicing the leg resolver and the two bridge directions
  on testnet is real preparation.
- **Get a funded wallet and a working signing setup.** Trivial, but it means
  zero friction on launch day.
- **Watch block time.** 420–670ms measured vs 100–200ms claimed. If that
  has not converged by mainnet, the throughput thesis is weaker than
  advertised, and that changes how much to stake into the Elysium story.

Low value: deploying testnet tokens, trying the faucet repeatedly, grinding
transactions. There is no faucet contract deployed and ~2 tx/block means
there is no competition for attention — nothing you do now is scarce.

## Revised practical read (with 900 HYPE, no KNTQ)

Capital is not the constraint. Liquidity is.

900 HYPE ≈ $84,000. Tier 1 costs ~$16,045, so you clear it on paper several
times over. But the KNTQ/USDC ask side totals only ~$10,530 — you cannot
buy tier 1 in one market order without pushing deep past the visible book.

So the sequence that actually makes sense:

1. **Verify other venues first.** Kinetiq docs name Lit and Based as places
   to buy KNTQ. Check their books before assuming Hyperliquid spot is it.
   Deeper liquidity there changes everything.
2. **If Hyperliquid spot is the only venue, clip in.** Limit orders only,
   small size, accumulate. Never market-buy into a 32k-token ask side.
3. **Do the sKNTQ stake in one deposit once you have 50k.** Staking is
   presumably per-position; fragmented tiers may not aggregate. Unverified.
4. **Mind the 7-day unstake.** Once in, you are committed for a week on exit.
   Do not size a position you might need to move.
5. **Keep HYPE as HYPE.** 900 HYPE is your working capital and your kHYPE
   staking base. Converting a chunk to KNTQ at thin-book prices is a real
   cost, not a free move.

The Elysium read still stands and is unchanged: 50% of sequencer revenue
funds KNTQ buybacks that accrue to sKNTQ holders. If you are going to hold
sKNTQ, the question is entry price and timing, not whether the thesis works.
