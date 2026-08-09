import type { Card, Character } from "@/lib/game/gameData";

/** The played card for one side of the centre versus board. */
export function BattleCard({
  card,
  colour,
  side,
  hidden,
}: {
  card: Card | undefined;
  colour: string;
  side: "left" | "right";
  hidden?: boolean;
}) {
  const show = card && !hidden;
  return (
    <div
      key={card?.id ?? `empty-${side}`}
      className={`relative h-40 w-32 overflow-hidden rounded-xl border-2 bg-card/70 backdrop-blur-md ${
        show ? "animate-slam" : "border-dashed"
      }`}
      style={{ borderColor: show ? colour : undefined }}
    >
      {show ? (
        <>
          <img
            loading="lazy"
            decoding="async"
            src={card!.image}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="relative flex h-full flex-col justify-between p-2 text-center">
            <span className="label-xs" style={{ color: colour }}>
              {card!.type}
            </span>
            <div>
              <p className="font-display text-[13px] leading-tight font-bold">{card!.name}</p>
              <div className="mt-1 flex justify-center gap-2 font-display text-[11px]">
                <span className="text-strike">KNK {card!.knock}</span>
                <span className="text-defense">PRI {card!.priority}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="grid h-full place-items-center">
          <span className="font-display text-3xl text-muted-foreground">?</span>
        </div>
      )}
    </div>
  );
}

/** A fighter on stage, sized to match the Home screen hero art. */
export function Combatant({
  character,
  name,
  side,
  hit,
  knock,
  share,
}: {
  character: Character;
  name: string;
  side: "left" | "right";
  hit: boolean;
  knock: number;
  share: number;
}) {
  const isLeft = side === "left";
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-[5] w-[440px] ${
        isLeft ? "left-0" : "right-0"
      } ${hit ? "animate-shake" : ""}`}
    >
      <div className="fa-pedestal absolute inset-x-0 bottom-16 h-44" />
      <img
        loading="lazy"
        decoding="async"
        src={character.fullArt}
        alt={character.name}
        className="fa-art absolute bottom-16 h-[600px] object-contain object-bottom"
        style={{
          [isLeft ? "left" : "right"]: "40px",
          transform: isLeft ? undefined : "scaleX(-1)",
        }}
      />
      <div
        className={`absolute top-20 z-10 w-[300px] ${isLeft ? "left-8 text-left" : "right-8 text-right"}`}
      >
        <p className="label-xs" style={{ color: character.color }}>
          {character.name} · {character.className}
        </p>
        <p className="truncate font-display text-[13px] text-muted-foreground">{name}</p>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border border-border/70 bg-secondary">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isLeft ? "" : "ml-auto"}`}
            style={{ width: `${share}%`, background: character.color }}
          />
        </div>
        <p className="mt-1 font-display text-sm font-bold">{knock} KNOCK</p>
      </div>
    </div>
  );
}

/**
 * Deterministic randomness. Both players resolve the same bout on their own
 * device, so the crit rolls inside the combat engine must land identically —
 * Math.random is swapped for a seeded generator while the round resolves.
 */
export function withSeededRandom<T>(seed: string, run: () => T): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  const original = Math.random;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return run();
  } finally {
    Math.random = original;
  }
}
