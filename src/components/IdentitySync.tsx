import { useEffect } from "react";
import { usePlayer, normalizeHandle } from "@/lib/game/store";
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

  return null;
}
