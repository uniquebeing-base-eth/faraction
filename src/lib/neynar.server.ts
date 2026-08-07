/**
 * Neynar-backed Farcaster directory. Server-only so the API key never ships
 * to the browser.
 */
import { getSupabasePublic } from "./supabase-public.server";

export interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  followerCount: number;
  /** True when this user already has a FarAction profile. */
  isPlayer: boolean;
}

const BASE = "https://api.neynar.com/v2/farcaster";

interface NeynarUser {
  fid: number;
  username?: string;
  display_name?: string;
  displayName?: string;
  pfp_url?: string;
  /** Legacy / hydrated shape returned by some Neynar endpoints. */
  pfp?: { url?: string };
  profile?: { pfp_url?: string; pfp?: { url?: string } };
  follower_count?: number;
}

/** Handles are stored with a leading `@` in places — never render it twice. */
export function stripAt(value: string): string {
  return value.trim().replace(/^@+/, "");
}

function pfpOf(u: NeynarUser): string {
  return u.pfp_url ?? u.pfp?.url ?? u.profile?.pfp_url ?? u.profile?.pfp?.url ?? "";
}

interface PlayerRow {
  handle: string;
  fid: number | null;
}

/** Registered FarAction players, keyed by their normalized handle. */
async function fetchPlayerDirectory(): Promise<Map<string, PlayerRow>> {
  const { data } = await getSupabasePublic()
    .from("players")
    .select("handle, fid")
    .not("handle", "is", null)
    .limit(500);
  const map = new Map<string, PlayerRow>();
  for (const row of data ?? []) {
    const handle = stripAt(String(row.handle ?? "")).toLowerCase();
    if (!handle) continue;
    const existing = map.get(handle);
    // Keep the row that actually carries a fid.
    if (!existing || (!existing.fid && row.fid)) {
      map.set(handle, { handle, fid: row.fid ?? null });
    }
  }
  return map;
}

function normalize(u: NeynarUser, players: Map<string, PlayerRow>): FarcasterUser {
  const username = stripAt(u.username ?? "") || `fid-${u.fid}`;
  return {
    fid: u.fid,
    username,
    displayName: stripAt(u.display_name ?? u.displayName ?? "") || username,
    pfpUrl: pfpOf(u),
    followerCount: u.follower_count ?? 0,
    isPlayer: players.has(username.toLowerCase()),
  };
}

export async function searchFarcasterUsers(query: string, limit = 8): Promise<FarcasterUser[]> {
  const apiKey = process.env["NEYNAR_SECRET_KEY"] ?? process.env["NEYNAR_API_KEY"];
  const players = await fetchPlayerDirectory();
  const needle = stripAt(query).toLowerCase();

  if (!apiKey) {
    // Without a Neynar key we can still surface registered FarAction players —
    // and we keep their real fid so invites/notifications still resolve.
    return [...players.values()]
      .filter((p) => p.handle.includes(needle))
      .slice(0, limit)
      .map((p) => ({
        fid: p.fid ?? 0,
        username: p.handle,
        displayName: p.handle,
        pfpUrl: "",
        followerCount: 0,
        isPlayer: true,
      }));
  }

  const res = await fetch(`${BASE}/user/search?q=${encodeURIComponent(needle)}&limit=${limit}`, {
    headers: { accept: "application/json", "x-api-key": apiKey },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Neynar search failed [${res.status}]: ${body}`);
  }
  // Neynar has shipped both `{ result: { users } }` and a flat `{ users }`.
  const json = (await res.json()) as { result?: { users?: NeynarUser[] }; users?: NeynarUser[] };
  const users = json.result?.users ?? json.users ?? [];
  // FarAction players float to the top of the results.
  return users
    .filter((u) => Number.isFinite(u.fid) && u.fid > 0)
    .map((u) => normalize(u, players))
    .sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer));
}
