import { useEffect, useState } from "react";
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Layers3,
  ShieldCheck,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { addMiniApp } from "@/lib/miniapp";
import { sfx } from "@/lib/sound";

const STEPS = [
  {
    Icon: Swords,
    kicker: "Choose your fight",
    title: "Enter the arena",
    body: "Fight the House, play Ranked with an active Season Pass, or challenge a Farcaster player to a 1 vs 1 bout.",
  },
  {
    Icon: Layers3,
    kicker: "Build your sequence",
    title: "Lock five cards",
    body: "Pick your fighter and arrange five cards. Strike pressures, Defense absorbs, and Control disrupts priority and energy.",
  },
  {
    Icon: ShieldCheck,
    kicker: "Card vs card",
    title: "Win each clash",
    body: "Both sequences reveal one slot at a time. Priority, knock and card effects decide each clash—and the fighter left standing.",
  },
  {
    Icon: Trophy,
    kicker: "Rewards on Base",
    title: "Claim the win",
    body: "Competitive bouts charge the displayed USDC entry fee only when you go ready. In staked matches, the winner takes 90% of the pot.",
  },
] as const;

export function HowToPlayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [alertState, setAlertState] = useState<"idle" | "working" | "enabled" | "unavailable">("idle");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setStep((value) => Math.min(value + 1, STEPS.length - 1));
      if (event.key === "ArrowLeft") setStep((value) => Math.max(value - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;
  const current = STEPS[step]!;
  const Icon = current.Icon;

  const enableAlerts = async () => {
    setAlertState("working");
    const enabled = await addMiniApp();
    setAlertState(enabled ? "enabled" : "unavailable");
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[100] grid place-items-center bg-background/85 p-8 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="panel relative grid h-[570px] w-[900px] grid-cols-[0.85fr_1.15fr] overflow-hidden glow">
        <button
          type="button"
          aria-label="Close how to play"
          onClick={onClose}
          className="fa-chip absolute top-5 right-5 z-10 size-9 justify-center p-0 hover:border-accent/70"
        >
          <X className="size-4" />
        </button>

        <div className="relative flex flex-col justify-between border-r border-border/70 bg-primary/10 p-10">
          <div>
            <p className="label-xs text-accent">How to play · {step + 1}/{STEPS.length}</p>
            <Icon className="mt-12 size-24 text-accent" strokeWidth={1.25} />
          </div>
          <div className="flex gap-2" aria-label="Tutorial progress">
            {STEPS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Go to ${item.title}`}
                onClick={() => setStep(index)}
                className={`h-1.5 flex-1 rounded-full transition-colors ${index === step ? "bg-accent" : "bg-border"}`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col p-12 pt-24">
          <p className="label-xs text-facts">{current.kicker}</p>
          <h2 id="how-to-play-title" className="mt-3 font-display text-5xl font-bold leading-tight">
            {current.title}
          </h2>
          <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-muted-foreground">{current.body}</p>

          {step === STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => void enableAlerts()}
              disabled={alertState === "working" || alertState === "enabled"}
              className="fa-btn mt-8 self-start disabled:opacity-60"
            >
              <BellRing className="size-4" />
              {alertState === "working"
                ? "Opening alerts…"
                : alertState === "enabled"
                  ? "Battle alerts enabled"
                  : alertState === "unavailable"
                    ? "Open in Farcaster to enable"
                    : "Enable battle alerts"}
            </button>
          ) : null}

          <div className="mt-auto flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous tutorial step"
              onClick={() => {
                sfx.tap();
                setStep((value) => Math.max(value - 1, 0));
              }}
              disabled={step === 0}
              className="fa-btn-ghost disabled:opacity-30"
            >
              <ChevronLeft className="size-4" /> Previous
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  sfx.tap();
                  setStep((value) => Math.min(value + 1, STEPS.length - 1));
                }}
                className="fa-btn"
              >
                Next <ChevronRight className="size-4" />
              </button>
            ) : (
              <button type="button" onClick={onClose} className="fa-btn">
                Enter FarAction <Swords className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}