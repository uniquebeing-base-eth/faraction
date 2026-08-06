import type { Card as GameCard } from "@/lib/game/gameData";

const typeColor: Record<string, string> = {
  strike: "text-strike border-strike/50",
  defense: "text-defense border-defense/50",
  control: "text-control border-control/50",
};

export function CardTile({
  card,
  selected,
  disabled,
  onClick,
  compact,
}: {
  card: GameCard;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-lg border text-left transition-all duration-200 active:scale-[0.97] ${
        selected ? "border-accent glow" : "border-border/70"
      } ${disabled ? "opacity-40" : "hover:-translate-y-0.5"} ${compact ? "h-24" : "h-40"}`}
    >
      <img
        src={card.image}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover opacity-45 transition-transform duration-500 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
      <div className="relative flex h-full flex-col justify-between p-2">
        <div className="flex items-start justify-between gap-1">
          <span className={`label-xs rounded border px-1 py-0.5 ${typeColor[card.type]}`}>
            {card.type}
          </span>
          <span className="rounded bg-primary/25 px-1.5 py-0.5 font-display text-[11px] text-foreground">
            {card.energyCost}
          </span>
        </div>
        <div>
          <p className="font-display text-[11px] leading-tight font-bold">{card.name}</p>
          {!compact && (
            <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{card.effect}</p>
          )}
          <div className="mt-1 flex gap-2 font-display text-[10px]">
            <span className="text-strike">KNK {card.knock}</span>
            <span className="text-defense">PRI {card.priority}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
