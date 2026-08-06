/**
 * Farcaster identity for the signed-in mini app user.
 *
 * The username/pfp come from the Farcaster client's authenticated context
 * (`sdk.context.user`), so display names are never invented locally. Outside a
 * Farcaster client there is no identity and callers fall back to the wallet.
 */
import { useEffect, useState } from "react";

export interface FarcasterIdentity {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
}

let cached: FarcasterIdentity | null = null;
let loading: Promise<FarcasterIdentity | null> | null = null;
const listeners = new Set<(id: FarcasterIdentity | null) => void>();

async function load(): Promise<FarcasterIdentity | null> {
  if (typeof window === "undefined") return null;
  if (cached) return cached;
  loading ??= (async () => {
    try {
      // Loaded from CDN at runtime so the SDK never enters the server bundle.
      const url = "https://esm.sh/@farcaster/miniapp-sdk@0.3.0";
      const mod = (await import(/* @vite-ignore */ url)) as {
        sdk: {
          context: Promise<{
            user?: { fid?: number; username?: string; displayName?: string; pfpUrl?: string };
          }>;
        };
      };
      const ctx = await mod.sdk.context;
      const user = ctx?.user;
      if (!user?.fid) return null;
      cached = {
        fid: user.fid,
        username: user.username ?? `fid:${user.fid}`,
        displayName: user.displayName ?? user.username ?? `fid:${user.fid}`,
        pfpUrl: user.pfpUrl ?? null,
      };
      listeners.forEach((l) => l(cached));
      return cached;
    } catch {
      // Plain web browser — no Farcaster session.
      return null;
    }
  })();
  return loading;
}

/** Authenticated Farcaster user, or null outside a Farcaster client. */
export function useFarcasterIdentity() {
  const [identity, setIdentity] = useState<FarcasterIdentity | null>(cached);
  const [resolved, setResolved] = useState(Boolean(cached));

  useEffect(() => {
    const l = (id: FarcasterIdentity | null) => setIdentity(id);
    listeners.add(l);
    void load().then((id) => {
      setIdentity(id);
      setResolved(true);
    });
    return () => {
      listeners.delete(l);
    };
  }, []);

  return { identity, resolved };
}
