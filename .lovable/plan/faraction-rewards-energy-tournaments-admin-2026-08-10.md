# FarAction — Rewards, Energy, Tournaments & Admin

A single build covering the daily $FACTS claim contract, staked-match settlement,
automatic notifications, the Energy shop, tournaments with a TP leaderboard, and an
FID-gated admin area. Nothing in the existing battle, fighter, card, arena, ranked,
FP, auth or sharing flows changes behaviour.

## 1. Daily $FACTS claim (on-chain)

- Reward distributor: `0x546186f2e8Efc407Cea08cAd33a55433fD531F8E` on Base.
- Backend signer: `0xad3e2d50c2d1581D60A2b228001eDEE456637233` (key already stored as
  `BACKEND_SIGNER_KEY`).
- Rate: **500 $FACTS per 1,000 FP**. The contract's `calculateReward` handles the maths
  from `rewardRatePerThousandPoints`; the app shows the same figure before claiming.
- Flow: the claim screen asks the server for the user's claimable FP -> a server function
  signs `getMessageHash(user, "FACTS", userPoints)` with the backend signer -> the wallet
  calls `claimReward(tokenSymbol, userPoints, signature)` -> the confirmed tx is recorded
  in the claim ledger. Cooldown is read from `canClaimToday` /
  `getTimeUntilNextClaim` so the UI and the contract never disagree.
- Signing happens only on the server; the private key is never exposed to the browser.
- **Notification bonus:** enabling notifications grants a one-time **+1,000 FP**, credited
  server-side and recorded so it cannot be claimed twice.

## 2. Staked match settlement (bug fix)

Today both sides stake but the pot is never released, so winners receive nothing.

- Settlement moves to the server: once a bout completes, the result is verified against
  the stored match state and the vault is settled to the winner for **90% of the pot**
  (10% retained as the house fee, matching the current display).
- Settlement is idempotent and keyed on the match, so double-polling, refreshes, or both
  clients finishing at once can only settle once.
- The settlement transaction hash is written back to the match record and surfaced in the
  result screen, and losers/timeouts are handled explicitly rather than left open.

## 3. Automatic notifications

All sends go through Neynar with the existing app UUID. Triggered server-side, so they
fire even when the sender closes the app:

- You have been challenged to a 1v1
- Your challenge was accepted / declined / cancelled
- Your match is ready to start
- It is your move (nudged when the opponent has revealed and you have not)
- Victory / defeat result
- Tournament: registration open, tournament started, your tournament match is live,
  final standings published

Each notification is deduplicated by event key so a poll loop cannot spam a player.

## 4. Black Market — Energy boosts

Fighters have an energy pool (10–12+) that limits which cards they can carry. Energy
boosts are consumable, single-use, and permanently add energy to one fighter.

| Boost | Energy | Price |
| --- | --- | --- |
| Energy Spark | +1 | 1,000,000 $FACTS |
| Energy Surge | +2 | 2,500,000 $FACTS |
| Energy Core | +3 | 5,000,000 $FACTS |
| Energy Overdrive | +4 | 8,000,000 $FACTS |
| Energy Ascension | +5 | 12,000,000 $FACTS |

The five supplied artworks are used exactly as provided, served from the CDN. Purchases
are paid in $FACTS through the existing payment gateway, recorded as a purchase, then
consumed against a chosen fighter. Loadout building reads the fighter's boosted energy so
higher-cost cards unlock immediately after a boost is applied.

## 5. Leaderboards — three tabs

- **Ranked** (existing behaviour, unchanged): season leaderboard, ranked fighters only.
- **Global**: every player ranked by lifetime FP.
- **Tournament**: players ranked by TP, with a selector for the active or a past
  tournament.

## 6. Tournament system

Tournaments run daily, hourly, or for any custom window. Players must register to earn TP
or place. A tournament carries: title, description, banner, registration window, start and
end time, number of winners, status (draft, registration, live, completed, cancelled),
participants, matches, results, TP rewards and final winners.

1v1 battles played inside a tournament window by two registered players are attributed to
that tournament and award TP alongside the usual FP. Existing casual and ranked matches
are untouched.

## 7. Admin section

Reachable only by Farcaster **FID 849116**, enforced on the server for every read and
write — hiding the UI is not sufficient. The admin can create tournaments (title,
description, banner, registration window, start/end, winner count), start, end, or cancel
them, review participants and live progress, publish winners, and adjust tournament
points.

## 8. Technical notes

- **Database:** new tables for energy items, per-fighter energy and purchases, tournaments,
  registrations, tournament matches, results and TP ledger, plus an admin-FID allowlist.
  All in the public schema with explicit grants, RLS enabled, and writes restricted to
  server-side routines. Existing tables gain only additive columns.
- **Backend:** TanStack server functions for signing, settlement, purchases, tournament
  lifecycle and admin actions; scheduled public API routes handle tournament state
  transitions and the "your move" nudges.
- **Chain:** the distributor ABI supplied is wired in for `getMessageHash`,
  `calculateReward`, `canClaimToday`, `getTimeUntilNextClaim` and `claimReward`.
- **Testing:** end-to-end passes over claim, staked settlement, energy purchase and
  consumption, tournament registration through results, and admin gating — not UI alone.

## Out of scope / unchanged

1v1 battle logic, fighter and card selection, arena selection, ranked matchmaking, FP
earning rules, Farcaster auth, and the sharing/composer flow.
