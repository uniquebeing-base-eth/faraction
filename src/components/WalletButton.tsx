import { useEffect, useState } from "react";
import { LogOut, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useWallet, shortAddress } from "@/lib/onchain/wallet";

/**
 * Connects the Base wallet used for payments, staking and claims.
 * Inside Farcaster this uses the mini-app wallet; in a plain browser it uses
 * any injected wallet (MetaMask, Base/Coinbase Wallet, …). Click again to
 * disconnect.
 */
export function WalletButton() {
  const { address, connect, disconnect, connecting } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  if (address) {
    return (
      <button
        type="button"
        className="fa-chip hover:border-destructive/70"
        title="Disconnect wallet"
        onClick={() => {
          disconnect();
          toast.success("Wallet disconnected");
        }}
      >
        <LogOut className="size-3.5" />
        {shortAddress(address)}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="fa-chip hover:border-accent/70"
      disabled={connecting}
      onClick={() => {
        void connect().catch((e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Wallet connection failed"),
        );
      }}
    >
      <Wallet className="size-3.5" />
      {connecting ? "Connecting…" : "Connect"}
    </button>
  );
}
