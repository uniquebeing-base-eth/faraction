import { useActivityFeed, type ActivityKind } from "@/lib/activity";
import { Coins, Zap, Swords, Gift, Trophy, Crown } from "lucide-react";

const ICONS: Record<ActivityKind, typeof Coins> = {
  buy: Coins,
  pass: Zap,
  win: Swords,
  claim: Gift,
  rank: Trophy,
  house: Crown,
};

const TINTS: Record<ActivityKind, string> = {
  buy: "text-usdc",
  pass: "text-facts",
  win: "text-accent",
  claim: "text-facts",
  rank: "text-control",
  house: "text-strike",
};

/**
 * Scrolling ecosystem ticker. Keeps the arena feeling alive while browsing.
 */
export function ActivityTicker() {
  const events = useActivityFeed();
  if (events.length === 0) return null;
  const items = [...events.slice(0, 14), ...events.slice(0, 14)];

  return (
    <div className="fa-ticker group relative flex items-center overflow-hidden">
      <div className="fa-ticker-track flex shrink-0 items-center gap-8 pr-8">
        {items.map((e, i) => {
          const Icon = ICONS[e.kind];
          return (
            <span key={`${e.id}-${i}`} className="flex shrink-0 items-center gap-2 text-xs">
              <Icon className={`size-3.5 shrink-0 ${TINTS[e.kind]}`} />
              <span className="text-foreground/85">{e.text}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
