import { useCallback, useEffect, useState } from "react";
import type { Card, Character } from "./gameData";
import { planDays } from "./pass";

export interface PlayerState {
  /** Farcaster username (or wallet short address) — set by IdentitySync. */
  handle: string;
  /** Farcaster fid when signed in through a Farcaster client. */
  fid: number | null;
  /** Farcaster profile picture, straight from the mini app SDK context. */
  pfpUrl: string | null;
  /** Facts Points (FP) earned in battles. Ranked FP drives the leaderboard. */
  fp: number;
  /** FP earned in Ranked matches only — the leaderboard score. */
  rankedFp: number;
  wins: number;
  losses: number;
  /** FP/results earned before a wallet was connected — flushed to the server later. */
  pendingFp: number;
  pendingWins: number;
  pendingLosses: number;
  houseStreak: number;
  dailyClaimedOn: string | null;
  seasonPass: {
    plan: string;
    activatedAt: number;
    paidWith?: "USDC" | "FACTS";
    amountPaid?: number;
  } | null;
  unlockedCards: string[];
  fighterId: string;
  deck: string[];
  factsSeen: string[];
}

// v2 drops the locally simulated FACTS/USDC balances — balances now come from
// the connected wallet — so old records are reset rather than migrated.
const KEY = "faraction:player:v3";

export const DEFAULT_STATE: PlayerState = {
  handle: "",
  fid: null,
  pfpUrl: null,
  fp: 0,
  rankedFp: 0,
  wins: 0,
  losses: 0,
  pendingFp: 0,
  pendingWins: 0,
  pendingLosses: 0,
  houseStreak: 0,
  dailyClaimedOn: null,
  seasonPass: null,
  unlockedCards: [],
  fighterId: "kaira",
  deck: [],
  factsSeen: [],
};

let memory: PlayerState = DEFAULT_STATE;
const listeners = new Set<(s: PlayerState) => void>();

function read(): PlayerState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  const parse = (key: string): Partial<PlayerState> => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Partial<PlayerState>) : {};
    } catch {
      return {};
    }
  };
  try {
    // Older records are merged, never discarded: points and unlocked cards a
    // player already earned must survive every version bump.
    const old = { ...parse("faraction:player:v1"), ...parse("faraction:player:v2") };
    const cur = parse(KEY);
    const merged: PlayerState = { ...DEFAULT_STATE, ...old, ...cur };
    merged.fp = Math.max(Number(old.fp ?? 0), Number(cur.fp ?? 0), 0);
    merged.wins = Math.max(Number(old.wins ?? 0), Number(cur.wins ?? 0), 0);
    merged.losses = Math.max(Number(old.losses ?? 0), Number(cur.losses ?? 0), 0);
    merged.unlockedCards = Array.from(
      new Set([...(old.unlockedCards ?? []), ...(cur.unlockedCards ?? [])]),
    );
    return merged;
  } catch {
    return DEFAULT_STATE;
  }
}

function write(next: PlayerState) {
  memory = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l(next));
}

export function usePlayer() {
  const [state, setState] = useState<PlayerState>(memory);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    memory = read();
    setState(memory);
    setHydrated(true);
    const l = (s: PlayerState) => setState(s);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const update = useCallback(
    (patch: Partial<PlayerState> | ((s: PlayerState) => Partial<PlayerState>)) => {
      const base = memory;
      const p = typeof patch === "function" ? patch(base) : patch;
      write({ ...base, ...p });
    },
    [],
  );

  return { player: state, update, hydrated };
}

/**
 * Normalises any handle string to a single leading "@" for Farcaster
 * usernames, so stored values never end up as "@@name" or a bare name.
 */
export function normalizeHandle(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "";
}

/** Display name for the player: Farcaster username, wallet, or a neutral label. */
export function displayHandle(p: PlayerState): string {
  return p.handle || "Guest";
}

/** Total Facts Points earned across every battle. */
export function totalFp(p: PlayerState): number {
  return p.fp;
}

export function passIsActive(p: PlayerState): boolean {
  if (!p.seasonPass) return false;
  return Date.now() - p.seasonPass.activatedAt < planDays(p.seasonPass.plan) * 86_400_000;
}

/** Ms remaining on the pass (0 when inactive). */
export function passMsLeft(p: PlayerState): number {
  if (!p.seasonPass) return 0;
  const ends = p.seasonPass.activatedAt + planDays(p.seasonPass.plan) * 86_400_000;
  return Math.max(0, ends - Date.now());
}

/**
 * Ranked play, the Season Leaderboard and the 100,000,000 $FACTS reward pool
 * all require an active Season Pass. Casual modes never do.
 */
export function isRankedEligible(p: PlayerState): boolean {
  return passIsActive(p);
}

export function deckCards(deck: string[], all: Card[]): Card[] {
  return deck.map((id) => all.find((c) => c.id === id)).filter(Boolean) as Card[];
}

export function fighterOf(chars: Character[], id: string): Character {
  return chars.find((c) => c.id === id) ?? chars[0]!;
}
