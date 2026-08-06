import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { useWallet, shortAddress } from "@/lib/onchain/wallet";

/** Connects the Base wallet used for payments, staking and claims. */
export function WalletButton() {
  const { address, connect, connecting } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <button
      type="button"
      className="fa-chip hover:border-accent/70"
      disabled={connecting}
      onClick={() => {
        if (address) return;
        void connect().catch((e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Wallet connection failed"),
        );
      }}
    >
      <Wallet className="size-3.5" />
      {address ? shortAddress(address) : connecting ? "Connecting…" : "Connect"}
    </button>
  );
}
