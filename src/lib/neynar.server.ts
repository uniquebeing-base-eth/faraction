/**
 * Neynar-backed Farcaster directory. Server-only so the API key never ships
 * to the browser.
 */
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
  pfp_url?: string;
  follower_count?: number;
}

function normalize(u: NeynarUser, players: Set<string>): FarcasterUser {
  const username = u.username ?? `fid-${u.fid}`;
  return {
    fid: u.fid,
    username,
    displayName: u.display_name ?? username,
    pfpUrl: u.pfp_url ?? "",
    followerCount: u.follower_count ?? 0,
    isPlayer: players.has(username.toLowerCase()),
  };
}

export async function searchFarcasterUsers(query: string, limit = 8): Promise<FarcasterUser[]> {
  const apiKey = process.env["NEYNAR_SECRET_KEY"] ?? process.env["NEYNAR_API_KEY"];
  const { fetchPlayerHandles } = await import("./chain.server");
  const players = new Set(await fetchPlayerHandles());
  if (!apiKey) {
    // Without a Neynar key we can still surface registered FarAction players.
    return [...players]
      .filter((p) => p.includes(query.toLowerCase()))
      .slice(0, limit)
      .map((p, i) => ({
        fid: i,
        username: p,
        displayName: p,
        pfpUrl: "",
        followerCount: 0,
        isPlayer: true,
      }));
  }

  const res = await fetch(`${BASE}/user/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
    headers: { accept: "application/json", "x-api-key": apiKey },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Neynar search failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { result?: { users?: NeynarUser[] } };
  const users = json.result?.users ?? [];
  // FarAction players float to the top of the results.
  return users
    .map((u) => normalize(u, players))
    .sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer));
}
