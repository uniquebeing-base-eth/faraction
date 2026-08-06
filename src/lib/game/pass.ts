/**
 * Season Pass catalogue. Add a tier here and the whole app picks it up.
 *
 * A pass is required for Ranked Mode, the Season Leaderboard and the
 * 100,000,000 $FACTS reward pool. Casual play (House Boss, 1 vs 1, friend
 * matches) never requires one.
 */
export type PassPlanId = "15d" | "30d" | "50d";

export interface PassPlan {
  id: PassPlanId;
  /** Price in USDC. FACTS pricing is derived live from the market feed. */
  priceUsdc: number;
  days: number;
  label: string;
  note: string;
  popular?: boolean;
}

export const PASS_PLANS: PassPlan[] = [
  { id: "15d", priceUsdc: 0.25, days: 15, label: "15 DAYS", note: "Full Season 1" },
  { id: "30d", priceUsdc: 0.45, days: 30, label: "30 DAYS", note: "Best value", popular: true },
  { id: "50d", priceUsdc: 1, days: 50, label: "50 DAYS", note: "Long haul" },
];

/** Legacy plan ids from earlier builds still resolve to a duration. */
const LEGACY_DAYS: Record<string, number> = { "7d": 7, "90d": 90 };

export function planDays(id: string): number {
  return PASS_PLANS.find((p) => p.id === id)?.days ?? LEGACY_DAYS[id] ?? 15;
}

export function planById(id: string): PassPlan {
  return PASS_PLANS.find((p) => p.id === id) ?? PASS_PLANS[0]!;
}

/** What a pass unlocks — surfaced on the pass screen and gating notices. */
export const PASS_UNLOCKS = [
  "Join Ranked Matches",
  "Appear on the Season Leaderboard",
  "Eligible for the 100,000,000 $FACTS reward pool",
];

export const PASS_FREE_WITHOUT = [
  "Play House Boss",
  "Play 1 vs 1",
  "Join Friend Matches",
  "Earn normal match rewards",
];
