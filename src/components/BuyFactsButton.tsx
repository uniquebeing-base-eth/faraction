import { useState } from "react";
import { ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { baseToken, swapToken } from "@/lib/miniapp";
import { FACTS_ADDRESS } from "@/lib/onchain/contracts";
import { sfx } from "@/lib/sound";

/**
 * Buy $FACTS through the Farcaster native swap drawer. The CAIP-19 token id
 * carries the chain, so the host handles the network — we never switch chains
 * or call an RPC here.
 */
export function BuyFactsButton() {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        sfx.tap();
        setBusy(true);
        void swapToken({ buyToken: baseToken(FACTS_ADDRESS) })
          .catch((e: unknown) =>
            toast.error(e instanceof Error ? e.message : "Could not open the swap."),
          )
          .finally(() => setBusy(false));
      }}
      className="fa-chip border-facts/60 bg-facts/15 text-facts hover:border-facts"
      aria-label="Buy FACTS"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShoppingCart className="size-3.5" />}
      Buy $FACTS
    </button>
  );
}
