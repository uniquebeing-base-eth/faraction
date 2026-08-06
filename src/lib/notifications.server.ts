/**
 * Farcaster notification tokens + notification sending.
 *
 * Mini App clients deliver `miniapp_added` / `notifications_enabled` webhook
 * events containing a notification token and URL. We persist them here and use
 * them (via Neynar, with a direct-token fallback) to notify players.
 */
import { getSupabasePublic } from "./supabase-public.server";

const NEYNAR_BASE = "https://api.neynar.com/v2/farcaster";

function apiKey() {
  return process.env["NEYNAR_SECRET_KEY"] ?? process.env["NEYNAR_API_KEY"] ?? null;
}

export type MiniAppEventName =
  | "miniapp_added"
  | "miniapp_removed"
  | "notifications_enabled"
  | "notifications_disabled"
  // Legacy frame-era aliases.
  | "frame_added"
  | "frame_removed";

/** Store (or refresh) a notification token for a fid. */
export async function saveNotificationToken(input: {
  fid: number;
  token: string;
  url: string;
  event: string;
}) {
  const { error } = await getSupabasePublic().rpc("save_notification_token", {
    p_fid: input.fid,
    p_token: input.token,
    p_url: input.url,
    p_event: input.event,
  });
  if (error) throw new Error(`Could not store notification token: ${error.message}`);
}

/** Disable every token for a fid (app removed or notifications turned off). */
export async function disableNotificationTokens(fid: number, event: string) {
  await getSupabasePublic().rpc("disable_notification_tokens", { p_fid: fid, p_event: event });
}

/**
 * Opted-in fids. Notification tokens themselves are never read back out of the
 * database — delivery goes through Neynar, which owns token rotation.
 */
export async function listEnabledFids(fids?: number[]): Promise<number[]> {
  const { data } = await getSupabasePublic().rpc("list_notification_fids");
  const all = (data ?? []).map((r) => r.fid);
  return fids?.length ? all.filter((f) => fids.includes(f)) : all;
}

interface SendResult {
  sent: number;
  failed: number;
  via: "neynar" | "tokens" | "none";
}

/** Neynar accepts at most 100 target fids per call. */
const MAX_FIDS_PER_CALL = 100;

/**
 * Send a notification to specific fids, or broadcast to everyone who enabled
 * notifications.
 *
 * Delivery goes through Neynar, which holds the per-user notification tokens
 * (the manifest points `webhookUrl` at Neynar's app event endpoint, so this app
 * never stores a token). Constraints Neynar enforces server-side, applied here
 * so a send is never silently rejected:
 *
 * - `title` ≤ 32 chars and `body` ≤ 128 chars — hard-truncated;
 * - `target_url` must be on the manifest domain;
 * - `target_fids: []` broadcasts to every opted-in user;
 * - `uuid` is an idempotency key — a fresh one per call, so retries dedupe but
 *   distinct events are never suppressed.
 */
export async function sendMiniAppNotification(input: {
  title: string;
  body: string;
  targetUrl: string;
  fids?: number[];
  /** Stable id so clients de-duplicate re-sends. */
  notificationId?: string;
}): Promise<SendResult> {
  const key = apiKey();
  if (!key) {
    console.error("Neynar notification skipped: NEYNAR_SECRET_KEY is not configured");
    return { sent: 0, failed: 0, via: "none" };
  }

  // No explicit audience means broadcast: an empty array tells Neynar to send
  // to everyone who enabled notifications, which is exactly right now that it
  // — not us — owns the token list.
  const explicit = input.fids?.length ? input.fids : [];
  const chunks: number[][] = explicit.length
    ? Array.from({ length: Math.ceil(explicit.length / MAX_FIDS_PER_CALL) }, (_, i) =>
        explicit.slice(i * MAX_FIDS_PER_CALL, (i + 1) * MAX_FIDS_PER_CALL),
      )
    : [[]];

  const title = input.title.slice(0, 32);
  const body = input.body.slice(0, 128);

  let sent = 0;
  let failed = 0;

  for (const chunk of chunks) {
    // Fresh uuid per call: reusing one suppresses the send as a duplicate.
    const uuid = chunks.length === 1 && input.notificationId ? input.notificationId : crypto.randomUUID();
    const res = await fetch(`${NEYNAR_BASE}/frame/notifications/`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify({
        target_fids: chunk,
        notification: { title, body, target_url: input.targetUrl, uuid },
      }),
    });

    if (res.ok) {
      sent += chunk.length || 1;
    } else {
      failed += chunk.length || 1;
      console.error(`Neynar notification failed [${res.status}]: ${await res.text()}`);
    }
  }

  return { sent, failed, via: failed && !sent ? "none" : "neynar" };
}

