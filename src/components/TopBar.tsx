import { Link } from "@tanstack/react-router";
import { Zap, Coins, ChevronLeft, Volume2, VolumeX, CircleHelp } from "lucide-react";
import { useEffect, useState } from "react";
import { useTokenBalances } from "@/lib/onchain/balances";
import { FactsPriceChip } from "@/components/FactsPriceChip";
import { WalletButton } from "@/components/WalletButton";
import { BuyFactsButton } from "@/components/BuyFactsButton";
import { useFarcasterIdentity } from "@/lib/farcaster/identity";
import { hydrateMute, isMuted, setMuted, sfx, subscribeMute } from "@/lib/sound";
import { HowToPlayDialog } from "@/components/HowToPlayDialog";

/**
 * Overlay HUD. Floats over the world rather than pushing content down.
 */
export function TopBar({ title, back }: { title?: string; back?: string }) {
  const { facts, usdc, connected, isLoading } = useTokenBalances();
  const [muted, setLocalMuted] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const { identity } = useFarcasterIdentity();

  useEffect(() => {
    setLocalMuted(hydrateMute());
    const unsub = subscribeMute(setLocalMuted);
    return () => {
      unsub();
    };
  }, []);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center gap-4 px-8 pt-5">
      <div className="pointer-events-auto flex items-center gap-3">
        {back ? (
          <Link to={back} className="fa-chip hover:border-accent/70">
            <ChevronLeft className="size-3.5" />
            Back
          </Link>
        ) : null}
        <Link to="/" className="font-display text-lg font-bold tracking-[0.2em]">
          FAR<span className="text-accent">ACTION</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            sfx.tap();
            setHowToPlayOpen(true);
          }}
          className="fa-chip hover:border-accent/70"
        >
          <CircleHelp className="size-3.5" />
          How to play
        </button>
        {title ? (
          <>
            <span className="h-4 w-px bg-border" />
            <span className="label-xs">{title}</span>
          </>
        ) : null}
      </div>
      <div className="pointer-events-auto ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          onClick={() => {
            const next = !isMuted();
            setMuted(next);
            if (!next) sfx.tap();
          }}
          className="fa-chip hover:border-accent/70"
        >
          {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>
        <FactsPriceChip />
        <BuyFactsButton />
        <WalletButton />
        <span className="fa-chip border-facts/40 bg-facts/10 text-facts">
          <Zap className="size-3.5" />
          {connected ? (isLoading ? "…" : Math.floor(facts).toLocaleString()) : "—"}
        </span>
        <span className="fa-chip border-usdc/40 bg-usdc/10 text-usdc">
          <Coins className="size-3.5" />
          {connected ? (isLoading ? "…" : usdc.toFixed(2)) : "—"}
        </span>
        {identity ? (
          <span className="fa-chip gap-2 pl-1.5">
            {identity.pfpUrl ? (
              <img
                src={identity.pfpUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-5 rounded-full border border-border/60 object-cover"
              />
            ) : null}
            @{identity.username}
          </span>
        ) : null}
      </div>
      <HowToPlayDialog open={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} />
    </header>
  );
}
