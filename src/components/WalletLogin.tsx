/**
 * Entry screen for web users without a wallet.
 * Shows a "Connect Wallet" prompt for browser-based access.
 * Inside Farcaster, this is not shown.
 */

import { useEffect, useState } from "react";
import { Wallet, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/lib/onchain/wallet";

interface WalletLoginProps {
  onConnected?: () => void;
}

export function WalletLogin({ onConnected }: WalletLoginProps) {
  const { address, connect, connecting, error } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Browser/injected wallet access is intentionally disabled.
  if (!mounted || address) return null;
  return null;

  const handleConnect = async () => {
    try {
      await connect();
      toast.success("Wallet connected! Welcome to FarAction.");
      onConnected?.();
    } catch (e) {
      // Error is already shown by toast in WalletButton logic
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border/40 bg-card/80 p-8">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="grid size-16 place-items-center rounded-lg border border-facts/40 bg-facts/10">
              <Wallet className="size-8 text-facts" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome to FarAction</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect your Base wallet to start battling onchain.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-facts px-4 py-3 font-semibold text-background transition-all hover:bg-facts/90 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Wallet className="size-5" />
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-strike/20 bg-strike/10 p-3">
              <AlertCircle className="size-4 shrink-0 text-strike" />
              <p className="text-xs text-strike">{error}</p>
            </div>
          )}

          <div className="space-y-2 rounded-lg border border-border/40 bg-card/40 p-4">
            <p className="text-xs font-semibold text-foreground">Supported wallets:</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• MetaMask</li>
              <li>• Coinbase Wallet</li>
              <li>• Base Wallet</li>
              <li>• Any EIP-1193 compatible wallet</li>
            </ul>
          </div>

          <a
            href="https://metamask.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/40 bg-background px-4 py-2 text-xs font-semibold transition-colors hover:bg-card/40"
          >
            <ExternalLink className="size-4" />
            Don't have a wallet? Install MetaMask
          </a>
        </div>

        <div className="space-y-2 border-t border-border/40 pt-4">
          <p className="text-xs text-muted-foreground">
            💡 <strong>On Farcaster?</strong> FarAction is also available as a Mini App inside
            Warpcast. No wallet setup needed there.
          </p>
        </div>
      </div>
    </div>
  );
}
