/**
 * Staked-match payout.
 *
 * The vault never pushes funds: settlement credits the winner's balance and
 * the winner pulls it with `claim()`. This surfaces that balance and does the
 * withdrawal, so a winner always sees — and can take — their 90% of the pot.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { claimMatchWinnings, decimalsFor, readVaultClaimable } from "@/lib/onchain/actions";
import type { VaultAsset } from "@/lib/onchain/contracts";
import { useWallet } from "@/lib/onchain/wallet";

export function ClaimWinnings({
  asset = "USDC",
  compact = false,
}: {
  asset?: VaultAsset;
  compact?: boolean;
}) {
  const { address } = useWallet();
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      const raw = await readVaultClaimable(address as `0x${string}`, asset);
      setAmount(Number(raw) / 10 ** decimalsFor(asset));
    } catch (error) {
      console.error("Could not read vault winnings", error);
    }
  }, [address, asset]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (!address || amount <= 0) return null;

  const claim = async () => {
    setBusy(true);
    try {
      await claimMatchWinnings(asset);
      toast.success(`Claimed ${amount.toFixed(asset === "USDC" ? 2 : 0)} ${asset}`);
      setAmount(0);
      setTimeout(() => void refresh(), 6_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void claim()}
      disabled={busy}
      className={compact ? "fa-btn-ghost w-full" : "fa-btn w-full"}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
      Claim {amount.toFixed(asset === "USDC" ? 2 : 0)} {asset} winnings
    </button>
  );
}
