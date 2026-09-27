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

## TWAP: correct tool, with a hard cap that decides the schedule

Spot TWAP is available on Hyperliquid via the `twapOrder` exchange action
with a **spot asset id**, so it applies to KNTQ/USDC. Pair index is `334`
(`@334`, tokens [124, 0]).

Action shape:

```json
{ "type": "twapOrder",
  "twap": { "a": 334, "b": true, "s": "50000", "r": false, "m": 1440, "t": true } }
```

`a` = asset id 334, `b` = true for buy, `s` = size in **base tokens**
(50000, not USD), `r` = reduce-only, `m` = duration in minutes (5–1440, i.e.
up to 24h), `t` = randomize sub-order sizes ±20%.

Note: the official Python SDK does not expose `twapOrder`; the wire action
must be signed and POSTed directly, or via the `@nktkas/hyperliquid` TS SDK.
TWAP actions carry no `builder` field, so no builder attribution.

### The binding constraint: 3% sub-order slippage

Each sub-order is capped at **3% slippage**, venue-side. That is what sets
the pace, and it is not adjustable.

Measured: best ask $0.3209, so the sub-order ceiling is ~**$0.3305**. Anything
worse than +3% from the touch does not fill, and the TWAP falls behind its
execution target.

What the book looks like against that ceiling:

| Cumulative | Price | vs best ask |
|---|---|---|
| $1,095 | $0.32100 | +0.03% |
| $2,228 | $0.32128 | +0.13% |

The visible book only stays inside 3% for roughly the first **$2–3k** of
notional. Beyond that you are above the cap and sub-orders will not fill
reliably.

**So: TWAP over a long duration is mandatory, not a preference.** At
$16,045 total, a 24h TWAP is ~$11/hour average, which spreads across many
sub-orders and lets the book refill between them. A short-duration TWAP
would bunch sub-orders into a static book and mostly fail to fill.

Sizing sanity check from the docs: a $10,000 order over 1 hour splits into
~121 sub-orders of ~$83 every 30 seconds. That cadence would eat the whole
$10k ask side in minutes. **Do not use short durations here.**

### Other caveats

- $100 minimum total order size.
- Duration is 5 minutes to 7 days on the wire per one reference, 5–1440
  minutes per another. 1440 (24h) is the safe common denominator.
- If sub-orders do not fill, later sub-orders may grow to 3x normal size —
  which makes unfilled slices *worse* in a thin book, not better.
- No builder attribution, so no builder fees or referral credit from a TWAP.

### Revised execution plan

1. Check Lit / Based books first. Deeper venue beats any TWAP schedule.
2. If Hyperliquid spot is the venue: TWAP buy, `a=334`, `b=true`,
   `s=50000`, `m=1440`, `t=true`. 24 hours, randomized.
3. Monitor fill progress via `user_twap_slice_fills`. If it lags badly,
   the 3% ceiling is being hit and you should slow down rather than resize up.
4. Consider buying in tranches below 50k and staking once, rather than
   crossing 50k in one TWAP — smaller TWAPs are easier to fill inside 3%.
5. Re-verify the book before starting. It moved from 32,724 to 31,252 KNTQ
   between my two measurements in minutes; depth is not stable.

## Price action into the entry decision (measured 2026-09-27)

Daily candles for KNTQ/USDC (`@334`), Aug 17 – Sep 27. The picture: a
175% run off the ~$0.12 lows in early August, a spike high of **$0.35253 on
Sep 23**, then a stall.

```
date         close    chg%     volume   trades   avg trade $
2026-09-17  0.21840  11.67   8,727,044  11794     162
2026-09-18  0.26477  21.23   8,458,128  17249     130
2026-09-19  0.29361  10.89   7,809,851  25199      91
2026-09-20  0.32019   9.05   4,526,474  17782      82
2026-09-21  0.30549  -4.59   6,684,504  23265      88
2026-09-22  0.34325  12.36   4,543,067  24115      65
2026-09-23  0.33579  -2.17   5,300,053  30989      57   <- high 0.35253
2026-09-24  0.31554  -6.03   3,374,720  19119      56
2026-09-25  0.31760   0.65   2,464,478  19818      39
2026-09-26  0.32052   0.92   2,206,437  17329      41
2026-09-27  0.32087   0.11     175,079   1941      29
```

### The thing worth noticing: participation is draining

Volume fell from ~8.7M (Sep 17) to ~2.2M (Sep 26) — a **75% decline** —
while price went *up* 47%. Price made its high on the lowest volume of the
entire rally. That is the classic signature of a move running out of
buyers, not gathering steam.

Sharper still, **average trade size collapsed from ~$162 to ~$29** over the
same stretch. Trade *count* is roughly flat (11,794 → 17,329), so the
participants who remain are trading progressively smaller clips. The rally
was carried by large tickets early; it is now retail-scale churn.

Implication: the $0.35 stall is not indecision between two strong sides.
It is a thin, low-conviction book with a large resting bid beneath it.

### Current structure

| | |
|---|---|
| Last | $0.32087 |
| 3-day range | $0.3105 – $0.3263 (~5%) |
| 24h range | $0.3200 – $0.3223 (~0.7%) — very compressed |
| Bids | 163,489 KNTQ (~$52,300) |
| Asks | 32,686 KNTQ (~$10,517) |

The bid side is **5x the ask side** and has been stable across measurements
(172k → 163k over ~20 min). That asymmetry is a standing exit liquidity for
shorts and a cushion under price — it is why price held $0.31 rather than
breaking down after Sep 23.

But note the corollary: **almost nobody is offering to sell into this
rally.** Thin asks can mean bullish conviction, or it can mean the top is
unloaded and everyone is waiting. The declining average trade size argues
more toward the latter.

### On the entry question

The bullish case is real — Elysium is a genuine new revenue line, and 50% of
sequencer revenue funds KNTQ buybacks that accrue to sKNTQ holders. The
tactical case is weaker:

- You are buying after a 175% run, near the high, on falling volume.
- A pullback may never come if the broader market stays bid, as noted.
- If it does, the $0.31–$0.32 shelf is where the bid side sits.

The genuinely patient play is to let the consolidation resolve. A close above
~$0.353 confirms the breakout; a loss of ~$0.310 opens the shelf. Either
resolves the question, and the TWAP plan means you do not need to catch the
exact bottom — you can start a long-duration TWAP once direction is clearer
and still fill inside the 3% cap, because TWAP works over hours, not ticks.
