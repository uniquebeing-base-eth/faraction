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
      className={`group relative overflow-hidden rounded-xl border text-left transition-all duration-200 active:scale-[0.97] ${
        selected ? "border-fuchsia-400/70 bg-fuchsia-500/10 shadow-[0_0_30px_rgba(168,85,247,0.18)]" : "border-white/10 bg-slate-950/50"
      } ${disabled ? "opacity-40" : "hover:-translate-y-0.5"} ${compact ? "h-24" : "h-40"}`}
    >
      <img
        src={card.image}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover opacity-55 transition-transform duration-500 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,12,18,0.15),rgba(10,12,18,0.72)_42%,rgba(6,8,15,0.9))]" />
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-fuchsia-400 to-cyan-400 opacity-90" />
      <div className="relative flex h-full flex-col justify-between p-2.5">
        <div className="flex items-start justify-between gap-1">
          <span className={`label-xs rounded border px-1.5 py-0.5 ${typeColor[card.type]}`}>
            {card.type}
          </span>
          <span className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-display text-[11px] text-foreground">
            {card.energyCost}
          </span>
        </div>
        <div>
          <p className="font-display text-[11px] leading-tight font-bold tracking-[0.08em] text-white">{card.name}</p>
          {!compact && (
            <p className="mt-1 line-clamp-2 text-[10px] text-slate-200/80">{card.effect}</p>
          )}
          <div className="mt-1 flex gap-2 font-display text-[10px] tracking-[0.08em] text-slate-200">
            <span className="text-pink-300">KNK {card.knock}</span>
            <span className="text-cyan-300">PRI {card.priority}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
