/**
 * FarAction match layer — link-based multiplayer with no backend.
 *
 * A host creates a match locally; the whole match configuration is encoded
 * into the invite link, so a friend opening it inside Farcaster can join the
 * exact same match (mode, stake, host fighter) with no database round trip.
 *
 * Economy: both sides stake the same amount. The winner takes 90% of the pot,
 * the platform keeps 10%.
 */

import { MATCH_ENTRY_FEE_USDC, PROD_ORIGIN } from "@/lib/config";

export type MatchMode = "ranked" | "house" | "1v1";
export type StakeToken = "FACTS" | "USDC";
export type MatchRole = "host" | "joiner";

export interface MatchConfig {
  id: string;
  mode: MatchMode;
  staked: boolean;
  token: StakeToken;
  stake: number;
  difficulty: 0 | 1 | 2;
  hostHandle: string;
  hostFighterId: string;
  createdAt: number;
}

export interface ActiveMatch extends MatchConfig {
  role: MatchRole;
  joinerHandle?: string;
  joinerFighterId?: string;
  /** Farcaster handle challenged via Neynar search, when applicable. */
  invitedUsername?: string;
  paid: boolean;
  /** Server receipt id for the 0.01 USDC entry fee. */
  entryReceiptId?: string;
}

export const PLATFORM_FEE = 0.1;
export const WINNER_SHARE = 1 - PLATFORM_FEE;

export const STAKE_PRESETS: Record<StakeToken, number[]> = {
  FACTS: [500, 1000, 2500, 5000],
  USDC: [0.5, 1, 2.5, 5],
};

/**
 * Flat entry fee, in USDC, charged before EVERY competitive match (Ranked,
 * House Boss, 1 vs 1). Paid to the treasury with the standard Base payment
 * flow and verified server-side before the match may begin.
 */
export const ENTRY_FEE_USDC = MATCH_ENTRY_FEE_USDC;

/** Ranked mode requires an active Season Pass. */
export const RANKED_MODES: MatchMode[] = ["ranked"];

export function requiresSeasonPass(mode: MatchMode): boolean {
  return RANKED_MODES.includes(mode);
}

export function potFor(m: Pick<MatchConfig, "staked" | "stake">) {
  const pot = m.staked ? m.stake * 2 : 0;
  return {
    pot,
    winnerTake: +(pot * WINNER_SHARE).toFixed(6),
    fee: +(pot * PLATFORM_FEE).toFixed(6),
  };
}

/**
 * Human-shareable invite code, e.g. FAR2330330 — never a hash. Short enough to
 * read out in a cast, long enough to stay unique.
 */
export function newMatchId(): string {
  const digits = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join("");
  return `FAR${digits}`;
}

/** True for a well-formed FarAction invite code. */
export function isMatchCode(value: string): boolean {
  return /^FAR\d{5,10}$/i.test(value.trim());
}

/** Normalise anything a player types or pastes into a canonical code. */
export function normalizeMatchCode(value: string): string {
  const raw = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.startsWith("FAR") ? raw : `FAR${raw.replace(/^FA/, "")}`;
}

/* ---------------------------------------------------------------- encoding */

function toBase64Url(input: string): string {
  const b64 = typeof btoa === "function" ? btoa(input) : "";
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return typeof atob === "function" ? atob(padded) : "";
}

export function encodeMatch(m: MatchConfig): string {
  return toBase64Url(encodeURIComponent(JSON.stringify(m)));
}

export function decodeMatch(payload: string): MatchConfig | null {
  try {
    const raw = decodeURIComponent(fromBase64Url(payload));
    const parsed = JSON.parse(raw) as MatchConfig;
    if (!parsed?.id || !parsed?.mode) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Invite links always use the production domain — never localhost or a
 * preview origin — so a cast opened days later still resolves.
 */
export function inviteLink(m: MatchConfig): string {
  return `${PROD_ORIGIN}/invite/${m.id}?m=${encodeMatch(m)}`;
}

/** Canonical match permalink. */
export function matchLink(m: MatchConfig): string {
  return `${PROD_ORIGIN}/match/${m.id}?m=${encodeMatch(m)}`;
}

export function castText(m: MatchConfig): string {
  const { pot } = potFor(m);
  const wager = m.staked ? ` · ${m.stake} ${m.token} each · ${pot} ${m.token} pot` : "";
  return `FarAction match open — code ${m.id}${wager}. Tap in and take me on ⚔️`;
}

/* ------------------------------------------------------------- persistence */

const KEY = "faraction:active-match:v1";

export function saveActiveMatch(m: ActiveMatch) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function loadActiveMatch(): ActiveMatch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveMatch) : null;
  } catch {
    return null;
  }
}

export function clearActiveMatch() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ labels */

export function modeLabel(mode: MatchMode): string {
  if (mode === "house") return "House Boss";
  if (mode === "ranked") return "Ranked Match";
  return "1 vs 1";
}

export function formatAmount(n: number, token: StakeToken): string {
  return token === "USDC" ? `${n.toFixed(2)} USDC` : `${n.toLocaleString()} FACTS`;
}
