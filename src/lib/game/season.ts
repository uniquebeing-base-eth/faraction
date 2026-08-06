// ============================================================================
// Season configuration — single source of truth for season identity, duration
// and reward economics. Add a new season by writing a new SeasonConfig (the
// admin console persists one locally; contracts hold the onchain truth).
// ============================================================================
import { useCallback, useEffect, useState } from "react";

export interface SeasonConfig {
  /** Sequential season number. */
  number: number;
  /** Full display name, e.g. "Season 1 • Genesis: The Awakening". */
  name: string;
  /** Short label used in tight UI (chips, notes). */
  shortName: string;
  /** Unix ms the season clock started. */
  startedAt: number;
  /** Length of the season in days. */
  durationDays: number;
  /** Total FACTS distributed to the leaderboard at season close. */
  rewardPool: number;
}

/** Season 1 launch config. */
export const SEASON_1: SeasonConfig = {
  number: 1,
  name: "Season 1 • Genesis: The Awakening",
  shortName: "Season 1 · Genesis",
  // Launch anchor. The admin console can re-anchor or roll a new season.
  startedAt: Date.UTC(2026, 7, 5, 0, 0, 0),
  durationDays: 15,
  rewardPool: 100_000_000,
};

/**
 * Leaderboard payout curve — top 25, weighted heavily toward the top ranks.
 * Sums to the full 100,000,000 FACTS Season 1 pool.
 */
export const LEADERBOARD_REWARDS: number[] = [
  20_000_000, 15_000_000, 10_000_000, 7_500_000, 6_000_000, 4_500_000, 4_000_000, 3_500_000,
  3_000_000, 2_500_000, 2_000_000, 1_800_000, 1_700_000, 1_600_000, 1_500_000, 1_400_000, 1_300_000,
  1_200_000, 1_100_000, 1_000_000, 900_000, 800_000, 700_000, 600_000, 400_000,
];

export const REWARD_RANKS = LEADERBOARD_REWARDS.length; // 25

/** FACTS payable to a given 1-indexed rank (0 outside the paid band). */
export function rewardForRank(rank: number): number {
  return LEADERBOARD_REWARDS[rank - 1] ?? 0;
}

/** Compact FACTS formatting: 20,000,000 -> "20M". */
export function formatFacts(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

export interface SeasonStatus {
  config: SeasonConfig;
  endsAt: number;
  /** Milliseconds left; 0 once the season has closed. */
  msLeft: number;
  /** True once the timer hits zero: leaderboard locks, rewards claimable. */
  ended: boolean;
  /** 0..1 progress through the season. */
  progress: number;
  parts: { days: number; hours: number; minutes: number; seconds: number };
}

export function seasonStatus(config: SeasonConfig, now: number = Date.now()): SeasonStatus {
  const endsAt = config.startedAt + config.durationDays * 86_400_000;
  const msLeft = Math.max(0, endsAt - now);
  const total = config.durationDays * 86_400_000;
  const s = Math.floor(msLeft / 1000);
  return {
    config,
    endsAt,
    msLeft,
    ended: msLeft === 0,
    progress: Math.min(1, Math.max(0, (total - msLeft) / total)),
    parts: {
      days: Math.floor(s / 86_400),
      hours: Math.floor((s % 86_400) / 3_600),
      minutes: Math.floor((s % 3_600) / 60),
      seconds: s % 60,
    },
  };
}

// ── Persistence (admin-configurable season) ────────────────────────────────
const KEY = "faraction:season:v1";
let memory: SeasonConfig = SEASON_1;
const listeners = new Set<(s: SeasonConfig) => void>();

function read(): SeasonConfig {
  if (typeof window === "undefined") return SEASON_1;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return SEASON_1;
    return { ...SEASON_1, ...(JSON.parse(raw) as Partial<SeasonConfig>) };
  } catch {
    return SEASON_1;
  }
}

function write(next: SeasonConfig) {
  memory = next;
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l(next));
}

/** Live season config + ticking status. */
export function useSeason() {
  const [config, setConfig] = useState<SeasonConfig>(memory);
  const [now, setNow] = useState(() => memory.startedAt);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    memory = read();
    setConfig(memory);
    setNow(Date.now());
    setHydrated(true);
    const l = (s: SeasonConfig) => setConfig(s);
    listeners.add(l);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      listeners.delete(l);
      clearInterval(t);
    };
  }, []);

  const configure = useCallback((patch: Partial<SeasonConfig>) => {
    write({ ...memory, ...patch });
  }, []);

  const resetToDefault = useCallback(() => write(SEASON_1), []);

  return { config, status: seasonStatus(config, now), configure, resetToDefault, hydrated };
}
