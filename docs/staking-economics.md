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

## Practical read

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
