/**
 * Edge-safe verification of the JSON Farcaster Signature envelope used by
 * Mini App webhooks. Replaces @farcaster/miniapp-node, which pulls Solana
 * dependencies that cannot be bundled for the worker runtime.
 */

export type MiniAppWebhookEvent =
  | { event: "miniapp_added"; notificationDetails?: { token: string; url: string } }
  | { event: "miniapp_removed" }
  | { event: "notifications_enabled"; notificationDetails: { token: string; url: string } }
  | { event: "notifications_disabled" };

function b64urlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJson<T>(input: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(input))) as T;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function parseMiniAppWebhook(
  raw: unknown,
  apiKey: string,
): Promise<{ fid: number; event: MiniAppWebhookEvent }> {
  if (
    raw == null ||
    typeof raw !== "object" ||
    typeof (raw as Record<string, unknown>)["header"] !== "string" ||
    typeof (raw as Record<string, unknown>)["payload"] !== "string" ||
    typeof (raw as Record<string, unknown>)["signature"] !== "string"
  ) {
    throw new Error("Malformed webhook envelope");
  }
  const { header, payload, signature } = raw as {
    header: string;
    payload: string;
    signature: string;
  };

  const decodedHeader = b64urlToJson<{ fid: number; type: string; key: string }>(header);
  if (decodedHeader.type !== "app_key" || typeof decodedHeader.fid !== "number") {
    throw new Error("Unsupported signer type");
  }

  // 1. Verify the ed25519 signature over `${header}.${payload}`.
  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(decodedHeader.key) as unknown as ArrayBuffer,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    b64urlToBytes(signature) as unknown as ArrayBuffer,
    new TextEncoder().encode(`${header}.${payload}`) as unknown as ArrayBuffer,
  );
  if (!ok) throw new Error("Invalid signature");

  // 2. Confirm the app key is registered on-chain for that fid.
  const res = await fetch(
    `https://hub-api.neynar.com/v1/onChainSignersByFid?fid=${decodedHeader.fid}`,
    { headers: { "x-api-key": apiKey, accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Hub lookup failed: ${res.status}`);
  const hub = (await res.json()) as {
    events?: Array<{ signerEventBody?: { key?: string; eventType?: string } }>;
  };
  const wanted = decodedHeader.key.toLowerCase();
  const registered = (hub.events ?? []).some(
    (e) =>
      e.signerEventBody?.key?.toLowerCase() === wanted &&
      e.signerEventBody?.eventType === "SIGNER_EVENT_TYPE_ADD",
  );
  if (!registered) throw new Error("App key is not registered for this fid");

  return { fid: decodedHeader.fid, event: b64urlToJson<MiniAppWebhookEvent>(payload) };
}
