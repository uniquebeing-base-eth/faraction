import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CHARACTERS } from "@/lib/game/gameData";
import { usePlayer } from "@/lib/game/store";
import { TopBar } from "@/components/TopBar";
import { GameWorld } from "@/components/GameWorld";
import { useState } from "react";

export const Route = createFileRoute("/select-fighter")({
  head: () => ({
    meta: [
      { title: "Select Fighter — FarAction" },
      {
        name: "description",
        content: "Pick your FarAction fighter and lock in your class before the match.",
      },
      { property: "og:title", content: "Select Fighter — FarAction" },
      { property: "og:description", content: "Pick your fighter class and enter the Base arena." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SelectFighter,
});

function SelectFighter() {
  const { player, update } = usePlayer();
  const navigate = useNavigate();
  const [picked, setPicked] = useState(player.fighterId || "kaira");
  const active = CHARACTERS.find((c) => c.id === picked)!;

  return (
    <main className="fa-screen">
      <GameWorld dim={0.52} />
      <TopBar title="Roster" back="/" />

      <div className="relative z-10 flex h-full flex-col px-8 pt-20 pb-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="label-xs text-accent">Season 2</p>
            <h1 className="mt-2 font-display text-4xl tracking-[0.14em] uppercase">Roster</h1>
          </div>
          <div className="panel px-3 py-2 text-right">
            <p className="label-xs text-muted-foreground">Selected</p>
            <p className="font-display text-xl uppercase" style={{ color: active.color }}>
              {active.name}
            </p>
          </div>
        </div>

        <div className="relative mt-4 flex flex-1 items-center justify-center overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 bottom-10 mx-auto h-28 w-[70%] rounded-full bg-violet-500/20 blur-3xl" />
          <div className="flex w-full items-end justify-center gap-3 overflow-x-auto px-2 pb-2">
            {CHARACTERS.map((fighter) => {
              const selected = picked === fighter.id;
              const idx = CHARACTERS.findIndex((c) => c.id === fighter.id);
              const offset = idx - CHARACTERS.findIndex((c) => c.id === picked);

              return (
                <button
                  key={fighter.id}
                  type="button"
                  onClick={() => setPicked(fighter.id)}
                  className={`group relative shrink-0 rounded-[30px] border transition-all duration-300 ${
                    selected
                      ? "w-[360px] border-fuchsia-300/70 bg-white/6 shadow-[0_0_0_1px_rgba(217,70,239,0.36),0_28px_90px_rgba(168,85,247,0.38)]"
                      : "w-[120px] border-white/10 bg-black/15 opacity-75 hover:opacity-90"
                  }`}
                  style={{
                    transform: selected ? "translateY(0) scale(1.02)" : `translateY(${Math.abs(offset) * 9}px) scale(${1 - Math.abs(offset) * 0.06})`,
                    filter: selected ? "drop-shadow(0 0 26px rgba(217, 70, 239, 0.45))" : "saturate(0.7)",
                  }}
                >
                  <div className="relative overflow-hidden rounded-[28px] p-2">
                    <div
                      className="absolute inset-0 opacity-90"
                      style={{
                        background: `radial-gradient(circle at 50% 20%, ${fighter.color}66, transparent 48%), linear-gradient(180deg, rgba(16,18,26,0.2), rgba(8,9,14,0.8))`,
                      }}
                    />
                    <img
                      src={fighter.fullArt}
                      alt={fighter.name}
                      loading="lazy"
                      className={`relative z-10 mx-auto object-contain transition-all duration-300 ${selected ? "h-[420px] w-[260px]" : "h-[260px] w-[110px]"}`}
                      style={{ objectPosition: "center top" }}
                    />
                    <div className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-between gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur-sm">
                      <div>
                        <p className="font-display text-[9px] uppercase tracking-[0.18em] text-white/60">
                          {fighter.className}
                        </p>
                        <p className="font-display text-sm uppercase">{fighter.name}</p>
                      </div>
                      {selected ? <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-300 shadow-[0_0_15px_rgba(244,114,182,0.9)]" /> : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-end gap-4 rounded-[28px] border border-white/10 bg-black/20 p-4 backdrop-blur-md shadow-[0_0_0_1px_rgba(192,114,255,0.15),0_18px_50px_rgba(91,33,125,0.28)]">
          <div className="flex-1">
            <p className="label-xs text-accent">{active.className} class</p>
            <h2 className="mt-2 font-display text-4xl uppercase">{active.name}</h2>
            <p className="mt-2 max-w-[52ch] text-sm text-muted-foreground">{active.passive?.description}</p>
          </div>

          <div className="grid min-w-[230px] grid-cols-3 gap-3">
            {[
              ["KNOCK", active.knockStat],
              ["PRIORITY", active.priorityStat],
              ["DRAIN", active.drainStat],
            ].map(([label, value]) => (
              <div key={label} className="panel px-2 py-3 text-center">
                <p className="label-xs text-muted-foreground">{label}</p>
                <p className="mt-1 font-display text-xl">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {CHARACTERS.map((fighter, index) => (
              <button
                key={fighter.id}
                type="button"
                onClick={() => setPicked(fighter.id)}
                className={`h-2.5 rounded-full transition-all ${picked === fighter.id ? "w-10 bg-gradient-to-r from-fuchsia-400 to-cyan-400" : "w-2.5 bg-white/20"}`}
                aria-label={`Select ${fighter.name}`}
                style={{ boxShadow: picked === fighter.id ? `0 0 18px ${fighter.color}` : undefined }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              update({ fighterId: picked });
              navigate({ to: "/loadout" });
            }}
            className="fa-btn px-8"
          >
            Select fighter
          </button>
        </div>
      </div>
    </main>
  );
}
