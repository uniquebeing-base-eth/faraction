import { useRef } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

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
  const currentIndex = ARENAS.findIndex((item) => item.id === arena);
  const prevArena = ARENAS[(currentIndex - 1 + ARENAS.length) % ARENAS.length]!;
  const nextArena = ARENAS[(currentIndex + 1) % ARENAS.length]!;

  const choose = (id: ArenaId) => {
    sfx.select();
    onSelect(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label-xs text-fuchsia-300">Arena</p>
        <span className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-2 py-1 text-[9px] font-display uppercase tracking-[0.24em] text-fuchsia-100">
          {active.name}
        </span>
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Previous arena"
          onClick={() => choose(prevArena.id)}
          className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-fuchsia-300/50 bg-slate-950/70 text-fuchsia-100 shadow-[0_0_18px_rgba(192,114,255,0.25)] transition-transform hover:scale-105"
        >
          <ArrowLeft className="size-4" />
        </button>

        <button
          type="button"
          aria-label="Next arena"
          onClick={() => choose(nextArena.id)}
          className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-fuchsia-300/50 bg-slate-950/70 text-fuchsia-100 shadow-[0_0_18px_rgba(192,114,255,0.25)] transition-transform hover:scale-105"
        >
          <ArrowRight className="size-4" />
        </button>

        <div
          key={arena}
          className="arena-stage relative h-[220px] overflow-hidden rounded-[30px] border border-fuchsia-400/40 bg-black/20 shadow-[0_0_32px_rgba(168,85,247,0.2)]"
          style={{
            backgroundImage: `radial-gradient(120% 90% at 50% 100%, ${active.accent}55, transparent 70%), linear-gradient(180deg, ${active.sky[0]}, ${active.sky[1]})`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.18),transparent_18%)]" />
          <div className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-fuchsia-500/18 blur-3xl" />
          <div className="absolute -right-12 bottom-8 h-40 w-40 rounded-full bg-cyan-500/12 blur-3xl" />
          <div className="grid-floor absolute inset-x-0 bottom-0 h-24 opacity-40" />
          <div className="absolute inset-x-5 bottom-4 flex items-end justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-display uppercase tracking-[0.35em] text-white/60">Arena</p>
              <p
                className="font-display text-4xl font-black uppercase leading-none tracking-[0.08em] text-white"
                style={{ textShadow: `0 0 20px ${active.accent}88` }}
              >
                {active.name}
              </p>
              <p className="max-w-[28ch] text-[11px] uppercase tracking-[0.12em] text-white/70">
                {active.blurb}
              </p>
            </div>
            <div className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-[9px] font-display uppercase tracking-[0.28em] text-white/80 backdrop-blur-sm">
              {active.id}
            </div>
          </div>
          <div className="absolute left-1/2 top-[48%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm" />
          <img decoding="async"
            src={emblem}
            alt=""
            width={1024}
            height={1024}
            loading="lazy"
            className="arena-emblem absolute left-1/2 top-[48%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_0_30px_rgba(25,211,255,0.65)]"
          />
        </div>
      </div>

      <div ref={tray} className="tray-scroll -mx-1 flex gap-2 overflow-x-auto pb-1 pl-1 pr-1">
        {ARENAS.map((a) => {
          const on = a.id === arena;
          return (
            <button
              key={a.id}
              type="button"
              aria-label={a.name}
              aria-pressed={on}
              onClick={() => choose(a.id)}
              className={`tray-item relative h-24 w-28 shrink-0 overflow-hidden rounded-[18px] border-2 transition-all duration-300 ${
                on
                  ? "-translate-y-1 scale-[1.04] border-fuchsia-300 shadow-[0_0_22px_rgba(216,180,254,0.4)]"
                  : "border-white/10 opacity-75 hover:opacity-100"
              }`}
              style={{
                backgroundImage: `radial-gradient(100% 80% at 50% 100%, ${a.accent}66, transparent 70%), linear-gradient(180deg, ${a.sky[0]}, ${a.sky[1]})`,
              }}
            >
              {on ? (
                <Check className="absolute top-1.5 right-1.5 size-4 text-fuchsia-200" strokeWidth={3} />
              ) : null}
              <div className="absolute inset-x-2 bottom-2 h-1.5 rounded-full bg-white/10" />
              <span
                className="absolute inset-x-0 bottom-2 text-center font-display text-[10px] font-extrabold tracking-[0.18em] uppercase"
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
