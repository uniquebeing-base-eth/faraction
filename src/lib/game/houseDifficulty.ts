// @ts-nocheck
/* Ported combat logic — preserved from the original Action Order engine. */
// VS House difficulty: scoring and the rules that stop it being claimed rather
// than earned. Kept out of the route so it can be tested directly.

export type HouseDifficulty = 0 | 1 | 2 | 3;

export function clampDifficulty(value: unknown): HouseDifficulty {
  return Math.max(0, Math.min(3, Number(value) || 0)) as HouseDifficulty;
}

// Easy / Moderate / Hard (3 is the internal boss tier, not offered in the UI).
// Beating a harder boss is worth proportionally more toward the daily bounty,
// which keeps the reward for difficulty inside the fixed daily pool rather than
// creating a second, unbounded payout.
export const DIFFICULTY_POINT_MULTIPLIER: Record<HouseDifficulty, number> = {
  0: 1,
  1: 1.5,
  2: 2,
  3: 2.5,
};

export const HOUSE_WIN_BASE_POINTS = 100;
export const HOUSE_FLAWLESS_BONUS = 50;
export const HOUSE_LOSS_POINTS = 10;

/**
 * Points for a finished VS House match.
 *
 * `rewardDifficulty` must be the difficulty the match STARTED on, never the one
 * the current request asked for — see effectiveAiDifficulty.
 */
export function houseMatchPoints(params: {
  won: boolean;
  flawless: boolean;
  rewardDifficulty: HouseDifficulty;
}): number {
  if (!params.won) return HOUSE_LOSS_POINTS;
  const base = HOUSE_WIN_BASE_POINTS + (params.flawless ? HOUSE_FLAWLESS_BONUS : 0);
  return Math.round(base * DIFFICULTY_POINT_MULTIPLIER[params.rewardDifficulty]);
}

/**
 * Which difficulty the AI actually plays at on a given round.
 *
 * The client escalates mid-match on purpose (upper chamber, win streaks), so a
 * later round may legitimately ask for something harder. That is honoured,
 * because a harder opponent can never be an exploit. It can only go up: a
 * request asking for something easier than the match started on is ignored, and
 * the payout is pinned to the starting difficulty either way.
 *
 * Without this, a player could clear four rounds on easy, send hard on the round
 * that won the match, and collect the hard-mode reward.
 */
export function effectiveAiDifficulty(
  pinned: HouseDifficulty,
  requested: unknown,
): HouseDifficulty {
  return Math.max(pinned, clampDifficulty(requested)) as HouseDifficulty;
}
