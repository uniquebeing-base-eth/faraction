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
      <GameWorld dim={0.5} />
      <TopBar title="Select Fighter" back="/" />

      {/* Centre-stage fighter */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[5] w-[520px] -translate-x-1/2">
        <div
          className="fa-pedestal absolute inset-x-0 bottom-16 h-52"
          style={{ ["--tw-x" as string]: "" }}
        />
        <img
          loading="lazy"
          decoding="async"
          key={active.id}
          src={active.fullArt}
          alt={active.name}
          width={768}
          height={1024}
          className="fa-art animate-slam absolute bottom-20 left-1/2 h-[590px] -translate-x-1/2 object-cover object-top"
        />
      </div>

      <div className="relative z-10 grid h-full grid-cols-[150px_minmax(0,1fr)_380px] gap-7 px-8 pt-20 pb-6">
        {/* Roster rail */}
        <aside className="flex min-h-0 flex-col gap-2">
          <p className="label-xs">Roster</p>
          <div className="fa-scroll flex min-h-0 flex-1 flex-col gap-2 pr-1">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setPicked(c.id)}
                className={`relative shrink-0 overflow-hidden rounded-lg border transition-all active:scale-95 ${
                  picked === c.id ? "glow" : "border-border/60 opacity-60 hover:opacity-90"
                }`}
                style={picked === c.id ? { borderColor: c.color } : undefined}
              >
                <img
                  src={c.portrait}
                  alt={c.name}
                  loading="lazy"
                  className="h-24 w-full object-cover object-top"
                />
                <span className="absolute inset-x-0 bottom-0 bg-background/85 py-1 text-center font-display text-[10px] tracking-wider">
                  {c.name}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex flex-col justify-end pb-3">
          <div className="mx-auto text-center">
            <p className="label-xs" style={{ color: active.color }}>
              {active.className} Class
            </p>
            <h1 className="font-display text-5xl leading-none font-bold tracking-tight">
              {active.name}
            </h1>
          </div>
        </div>

        {/* Dossier */}
        <aside className="flex min-h-0 flex-col justify-center gap-3">
          <div className="panel grid grid-cols-3 gap-3 p-4">
            {(
              [
                ["Knock", active.knockStat, "var(--strike)"],
                ["Priority", active.priorityStat, "var(--defense)"],
                ["Drain", active.drainStat, "var(--facts)"],
              ] as const
            ).map(([label, val, color]) => (
              <div key={label}>
                <p className="label-xs">{label}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${val}%`, background: color }}
                  />
                </div>
                <p className="mt-1 font-display text-xs">{val}%</p>
              </div>
            ))}
          </div>

          <div className="panel space-y-2 p-4">
            <p className="label-xs text-accent">Passive · {active.passive?.name}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {active.passive?.description}
            </p>
            <p className="label-xs pt-1 text-facts">Ultimate · {active.ultimate?.name}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {active.ultimate?.description}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              update({ fighterId: picked });
              navigate({ to: "/loadout" });
            }}
            className="fa-btn w-full"
          >
            Lock Selection
          </button>
        </aside>
      </div>
    </main>
  );
}
