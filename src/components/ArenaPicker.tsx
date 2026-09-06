import { useRef } from "react";
import { Check } from "lucide-react";

import emblem from "@/assets/img/arena-selector-emblem.png";
import { ARENAS, getArena, type ArenaId } from "@/lib/game/arenas";
import { sfx } from "@/lib/sound";

interface Props {
  arena: ArenaId;
  onSelect: (id: ArenaId) => void;
}

/**
 * Image-first arena selection: one big lit stage showing the chosen arena,
 * plus a sliding tray of arena tiles underneath. Minimal copy on purpose —
 * the colours and the emblem carry the meaning.
 */
export function ArenaPicker({ arena, onSelect }: Props) {
  const active = getArena(arena);
  const tray = useRef<HTMLDivElement>(null);

  return (
    <div>
      <p className="label-xs">Arena</p>

      <div
        className="stage-glow relative mt-2 h-40 overflow-hidden rounded-xl border border-accent/40"
        style={{
          backgroundImage: `radial-gradient(120% 90% at 50% 100%, ${active.accent}55, transparent 70%), linear-gradient(180deg, ${active.sky[0]}, ${active.sky[1]})`,
        }}
      >
        <div className="grid-floor absolute inset-x-0 bottom-0 h-24 opacity-40" />
        <img
          src={emblem}
          alt=""
          width={1024}
          height={1024}
          loading="lazy"
          className="animate-float absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_0_28px_rgba(25,211,255,0.55)]"
        />
        <p
          className="absolute bottom-3 left-4 font-display text-2xl font-extrabold tracking-[0.14em] uppercase"
          style={{ color: active.accent }}
        >
          {active.name}
        </p>
      </div>

      <div ref={tray} className="tray-scroll mt-2 flex gap-2 overflow-x-auto pb-1">
        {ARENAS.map((a) => {
          const on = a.id === arena;
          return (
            <button
              key={a.id}
              type="button"
              aria-label={a.name}
              aria-pressed={on}
              onClick={() => {
                sfx.select();
                onSelect(a.id);
              }}
              className={`tray-item relative h-20 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-transform ${
                on ? "scale-105 border-accent glow" : "border-border/70 opacity-70"
              }`}
              style={{
                backgroundImage: `radial-gradient(100% 80% at 50% 100%, ${a.accent}66, transparent 70%), linear-gradient(180deg, ${a.sky[0]}, ${a.sky[1]})`,
              }}
            >
              {on ? (
                <Check className="absolute top-1.5 right-1.5 size-4 text-accent" strokeWidth={3} />
              ) : null}
              <span
                className="absolute inset-x-0 bottom-1 text-center font-display text-[11px] font-extrabold tracking-widest uppercase"
                style={{ color: a.accent }}
              >
                {a.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
