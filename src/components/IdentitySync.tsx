import { useEffect } from "react";
import { usePlayer, normalizeHandle } from "@/lib/game/store";
import { fetchPlayerProfile, syncPlayerStats } from "@/lib/battle.functions";
import { useFarcasterIdentity } from "@/lib/farcaster/identity";
import { useWallet, shortAddress } from "@/lib/onchain/wallet";

/**
 * Keeps the player's displayed handle tied to a real identity: the
 * authenticated Farcaster username when the app runs in a Farcaster client,
 * otherwise the connected wallet address. Never a made-up name.
 */
export function IdentitySync() {
  const { identity } = useFarcasterIdentity();
  const { address } = useWallet();
  const { player, update, hydrated } = usePlayer();

  useEffect(() => {
    if (!hydrated) return;
    const handle = identity?.username
      ? normalizeHandle(identity.username)
      : address
        ? shortAddress(address)
        : "";
    if (handle && handle !== player.handle) update({ handle });
    if (identity?.fid && identity.fid !== player.fid) update({ fid: identity.fid });
    if (identity?.pfpUrl && identity.pfpUrl !== player.pfpUrl)
      update({ pfpUrl: identity.pfpUrl });
  }, [identity, address, hydrated, player.handle, player.fid, player.pfpUrl, update]);

  useEffect(() => {
    if (!hydrated || !address) return;
    let cancelled = false;

    const handle = player.handle;
    const fid = player.fid;
    const pending = {
      fp: Math.max(0, Math.round(player.pendingFp)),
      wins: Math.max(0, Math.round(player.pendingWins)),
      losses: Math.max(0, Math.round(player.pendingLosses)),
    };

    const run = async () => {
      // Anything earned before the wallet was connected is pushed up first,
      // so nothing a player won is ever wiped by hydration.
      if (pending.fp > 0 || pending.wins > 0 || pending.losses > 0) {
        try {
          const totals = await syncPlayerStats({
            data: { wallet: address, handle, fid: fid ?? null, ...pending },
          });
          if (cancelled) return;
          update({
            fp: totals.fp,
            wins: totals.wins,
            losses: totals.losses,
            pendingFp: 0,
            pendingWins: 0,
            pendingLosses: 0,
          });
          return;
        } catch (error) {
          console.error("Could not sync offline Facts Points", error);
          return; // keep the pending buffer for the next attempt
        }
      }

      const profile = await fetchPlayerProfile({ data: { wallet: address } });
      if (cancelled) return;
      // Anything the device knows but the server doesn't is pushed up, so the
      // saved total always matches what the player can see.
      const missing = Math.max(0, Math.round(player.fp) - profile.fp);
      if (missing > 0) {
        try {
          const totals = await syncPlayerStats({
            data: { wallet: address, handle, fid: fid ?? null, fp: missing, wins: 0, losses: 0 },
          });
          if (cancelled) return;
          update({ fp: totals.fp, wins: totals.wins, losses: totals.losses });
          return;
        } catch (error) {
          console.error("Could not reconcile Facts Points", error);
        }
      }
      update((p) => ({
        fp: Math.max(profile.fp, p.fp),
        wins: Math.max(profile.wins, p.wins),
        losses: Math.max(profile.losses, p.losses),
      }));
    };

    void run().catch((error: unknown) => {
      console.error("Player profile hydration failed", error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    address,
    hydrated,
    update,
    player.pendingFp,
    player.pendingWins,
    player.pendingLosses,
    player.handle,
    player.fid,
  ]);


  return null;
}
