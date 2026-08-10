/**
 * Automatic battle notifications.
 *
 * Everything a player should hear about — a challenge, an acceptance, a match
 * going live, the opponent waiting on their move, the result, tournament
 * milestones — is sent from the server through Neynar, so it fires even when
 * the sender has closed the app. Every send is de-duplicated by event key, so
 * a polling client can never turn one event into a stream of pings.
 */
import { getSupabasePublic } from "./supabase-public.server";
import { sendMiniAppNotificationSafe } from "./notifications.server";
import { matchUrl, PROD_ORIGIN } from "./config";

/** True the first time an event key is seen; false for every repeat. */
async function claimSlot(key: string): Promise<boolean> {
  const { data, error } = await getSupabasePublic().rpc("claim_notification_slot", { p_key: key });
  if (error) {
    console.error("notification dedupe failed", error.message);
    return true;
  }
  return data !== false;
}

async function push(input: {
  key: string;
  fids: number[];
  title: string;
  body: string;
  targetUrl: string;
}) {
  const fids = input.fids.filter((f) => Number.isFinite(f) && f > 0);
  if (!fids.length) return { sent: 0 };
  if (!(await claimSlot(input.key))) return { sent: 0 };
  return sendMiniAppNotificationSafe({
    fids,
    title: input.title,
    body: input.body,
    targetUrl: input.targetUrl,
    notificationId: input.key,
  });
}

/** Resolve Farcaster ids for a set of handles or wallets. */
export async function fidsFor(input: { handles?: string[]; wallets?: string[] }) {
  const supabase = getSupabasePublic();
  const out = new Set<number>();

  const handles = (input.handles ?? []).map((h) => h.replace(/^@+/, "")).filter(Boolean);
  if (handles.length) {
    const { data } = await supabase.from("players").select("handle, fid").not("fid", "is", null);
    for (const row of data ?? []) {
      const handle = String(row.handle ?? "").replace(/^@+/, "").toLowerCase();
      if (handle && handles.some((h) => h.toLowerCase() === handle) && row.fid) out.add(row.fid);
    }
  }

  const wallets = (input.wallets ?? []).filter(Boolean).map((w) => w.toLowerCase());
  if (wallets.length) {
    const { data } = await supabase.from("players").select("wallet, fid").in("wallet", wallets);
    for (const row of data ?? []) if (row.fid) out.add(row.fid);
  }

  return [...out];
}

export function notifyChallenge(input: {
  matchId: string;
  fromHandle: string;
  toFid: number;
  staked?: boolean;
  stake?: number;
  token?: string;
}) {
  const wager = input.staked ? ` · ${input.stake} ${input.token}` : "";
  return push({
    key: `challenge-${input.matchId}-${input.toFid}`,
    fids: [input.toFid],
    title: "You've been challenged ⚔️",
    body: `@${input.fromHandle.replace(/^@+/, "")} wants to fight you in ${input.matchId}${wager}.`,
    targetUrl: matchUrl(input.matchId),
  });
}

export function notifyChallengeAccepted(input: {
  matchId: string;
  hostFid: number;
  joinerHandle: string;
}) {
  return push({
    key: `accepted-${input.matchId}`,
    fids: [input.hostFid],
    title: "Challenge accepted 🔥",
    body: `@${input.joinerHandle.replace(/^@+/, "")} accepted ${input.matchId}. Lock your loadout.`,
    targetUrl: matchUrl(input.matchId),
  });
}

export function notifyMatchReady(input: { matchId: string; fids: number[] }) {
  return push({
    key: `ready-${input.matchId}`,
    fids: input.fids,
    title: "Your match is live ⚔️",
    body: `Both fighters are ready. ${input.matchId} starts now.`,
    targetUrl: matchUrl(input.matchId),
  });
}

export function notifyYourMove(input: {
  matchId: string;
  fid: number;
  round: number;
  slot: number;
  opponentHandle: string;
}) {
  return push({
    key: `move-${input.matchId}-${input.round}-${input.slot}-${input.fid}`,
    fids: [input.fid],
    title: "Your move 🕹️",
    body: `@${input.opponentHandle.replace(/^@+/, "")} is waiting for you to reveal slot ${input.slot}.`,
    targetUrl: matchUrl(input.matchId),
  });
}

export function notifyResult(input: {
  matchId: string;
  winnerFid: number | null;
  loserFid: number | null;
  winnerHandle: string;
  loserHandle: string;
  payout?: string | null;
}) {
  const jobs: Promise<unknown>[] = [];
  if (input.winnerFid) {
    jobs.push(
      push({
        key: `result-win-${input.matchId}`,
        fids: [input.winnerFid],
        title: "Victory 🏆",
        body: `You beat @${input.loserHandle.replace(/^@+/, "")}${input.payout ? ` · ${input.payout}` : ""}.`,
        targetUrl: matchUrl(input.matchId),
      }),
    );
  }
  if (input.loserFid) {
    jobs.push(
      push({
        key: `result-lose-${input.matchId}`,
        fids: [input.loserFid],
        title: "Defeat ⚔️",
        body: `@${input.winnerHandle.replace(/^@+/, "")} took the bout. Run it back.`,
        targetUrl: matchUrl(input.matchId),
      }),
    );
  }
  return Promise.all(jobs);
}

export function notifyTournament(input: {
  key: string;
  title: string;
  body: string;
  fids?: number[];
}) {
  return push({
    key: input.key,
    // An empty audience is a broadcast to everyone who opted in.
    fids: input.fids?.length ? input.fids : [-1],
    title: input.title,
    body: input.body,
    targetUrl: `${PROD_ORIGIN}/tournaments`,
  }).catch(() => ({ sent: 0 }));
}

/** Broadcast to every opted-in player (used for tournament announcements). */
export async function broadcast(input: { key: string; title: string; body: string; url?: string }) {
  if (!(await claimSlot(input.key))) return { sent: 0 };
  return sendMiniAppNotificationSafe({
    title: input.title,
    body: input.body,
    targetUrl: input.url ?? PROD_ORIGIN,
    notificationId: input.key,
  });
}