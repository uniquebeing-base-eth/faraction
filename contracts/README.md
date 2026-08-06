# FarAction Contracts (Base)

factsRewardDistributor.sol : 0xB2b1831Aea1E318a976751702d37CB9eB0860C3c 
`StakedMatchVault.sol   :    0x0a7701af00D818bF9F0c89f6971697f69638b142
FactsPaymentGateway.sol  :   0xbb5858B4465bc9169567a3246b215f0197867574 

Solidity sources only — build/deploy is left to you. All contracts are
self-contained (no external dependency imports), target `^0.8.24`, and are
written for Base mainnet.

| Contract | Purpose |
| --- | --- |
| `FactsRewardDistributor.sol` | Pull-based $FACTS rewards: daily claims, season leaderboard payouts, admin distributions,Address : 0xB2b1831Aea1E318a976751702d37CB9eB0860C3c 
campaigns/events. | 
| `StakedMatchVault.sol` | Staked match escrow. Single reward asset per match (USDC **or** FACTS). 90% winner / 10% treasury. | address :  0x0a7701af00D818bF9F0c89f6971697f69638b142
| `FactsPaymentGateway.sol` | Receives $FACTS for season passes, cosmetics, unlocks, marketplace. Emits events for backend tracking. | Address : 0xbb5858B4465bc9169567a3246b215f0197867574 

Each file inlines its own `IERC20`, `SafeERC20`, `Auth` (owner + operators),
`Pausable` and `ReentrancyGuard` — there are **no imports at all**.

## Deploying in Remix

1. Create a new file in Remix (any name, e.g. `FactsPaymentGateway.sol`).
2. Paste the full contents of the matching file from `contracts/`.
3. Compile with Solidity `0.8.24`–`0.8.28`, optimizer on (200 runs), then deploy
   with the constructor args below.

All three compile clean (no errors) on solc 0.8.28.

Note: `reference` is a reserved word in Solidity, so the payment gateway's
event/param is named `paymentRef`.


## Addresses

- `$FACTS` token: `0xb38760f61668ace43d8ee2e137d092841b23eb07`
- Treasury: `0xd6b69e58d44e523eb58645f1b78425c96dfa648c`
- USDC (Base): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## Constructor arguments

```
FactsRewardDistributor(facts, owner)
StakedMatchVault(usdc, facts, treasury, owner)
FactsPaymentGateway(facts, treasury, owner)
```

## Claim model

Nothing is ever pushed to users. Every reward path is **claim-only**:

- Season/daily/campaign FACTS → `FactsRewardDistributor.claim(campaignId)` or
  `claimMany([...])`.
- Staked match winnings → `StakedMatchVault.claim(asset)`.

The treasury 10% cut on a settled match is the one automatic transfer, sent
directly to the treasury at settlement.

## Season 1 flow (• Genesis: The Awakening)

1. Fund the distributor with `100,000,000 FACTS` (`fund`, after `approve`).
2. `createCampaign("Season 1 • Genesis: The Awakening", startsAt, endsAt)` —
   the 15-day season clock ends at `startsAt + 15 days`.
3. When the timer hits zero the leaderboard locks off-chain; operator calls
   `allocateBatch(campaignId, top25Addresses, SEASON_1_REWARDS)` and then
   `lockCampaign(campaignId)`.
4. The top 25 call `claim(campaignId)`.

Reward curve (sums to 100,000,000 FACTS) matches
`src/lib/game/season.ts → LEADERBOARD_REWARDS`, so the UI and the onchain
allocation always agree.

## USDC payments (Base payment rails)

USDC purchases (season passes, store items) are **not** routed through a
contract. The client builds a plain ERC-20 `transfer` to the treasury using
Base payment rails (Coinbase Onchain Kit / Base Pay), and the backend tracks
settlement from the transfer log. The only USDC that touches a contract is
match stakes held in `StakedMatchVault`, where escrow is required.

## Extending

- New season → new campaign id in `FactsRewardDistributor`. No redeploy.
- New store item → `setPrice(keccak256("SKU"), price)` on the gateway.
- New game mode / arena → new `matchId` namespace in the vault. No redeploy.
- Backend automation runs under `setOperator(addr, true)`; `owner` stays a
  multisig and is transferred with the two-step `transferOwnership` /
  `acceptOwnership`.
