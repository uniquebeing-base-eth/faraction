import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Settings, RotateCcw } from "lucide-react";
import { Screen } from "@/components/Screen";
import { useSeason } from "@/lib/game/season";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Season Admin — FarAction" },
      {
        name: "description",
        content:
          "Configure the active FarAction season: name, start, duration and the $FACTS reward pool.",
      },
      { property: "og:title", content: "Season Admin — FarAction" },
      {
        property: "og:description",
        content: "Roll a new FarAction season once the current one closes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Admin,
});

function toLocalInput(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Admin() {
  const { config, status, configure, resetToDefault } = useSeason();
  const [draft, setDraft] = useState(config);
  const [saved, setSaved] = useState(false);

  const field = "w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm";

  return (
    <Screen
      title="Season Admin"
      eyebrow="Station · Operations"
      heading="Season Configuration"
      blurb="A new season can be configured once the active season timer reaches zero. Reward curves stay modular — the onchain distributor holds the authoritative payouts."
      aside={
        <div className="space-y-2">
          <div className="panel p-3">
            <p className="label-xs">Active season</p>
            <p className="font-display text-sm">{config.name}</p>
          </div>
          <div className="panel p-3">
            <p className="label-xs">State</p>
            <p className="font-display text-sm">
              {status.ended ? "Closed · rewards claimable" : "Live · leaderboard open"}
            </p>
          </div>
          <button type="button" onClick={resetToDefault} className="fa-btn-ghost w-full">
            <RotateCcw className="size-4" /> Reset to Season 1
          </button>
        </div>
      }
    >
      <div className="fa-scroll max-h-full space-y-3 pr-1">
        {!status.ended ? (
          <p className="panel p-3 text-xs text-muted-foreground">
            The current season is still live. Changes here take effect immediately — normally you
            roll a new season only after the timer hits zero and rewards are claimable.
          </p>
        ) : null}

        <label className="block">
          <span className="label-xs">Season number</span>
          <input
            type="number"
            className={field}
            value={draft.number}
            onChange={(e) => setDraft({ ...draft, number: Number(e.target.value) })}
          />
        </label>
        <label className="block">
          <span className="label-xs">Season name</span>
          <input
            className={field}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label-xs">Short label</span>
          <input
            className={field}
            value={draft.shortName}
            onChange={(e) => setDraft({ ...draft, shortName: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label-xs">Start</span>
          <input
            type="datetime-local"
            className={field}
            value={toLocalInput(draft.startedAt)}
            onChange={(e) => setDraft({ ...draft, startedAt: new Date(e.target.value).getTime() })}
          />
        </label>
        <label className="block">
          <span className="label-xs">Duration (days)</span>
          <input
            type="number"
            className={field}
            value={draft.durationDays}
            onChange={(e) => setDraft({ ...draft, durationDays: Number(e.target.value) })}
          />
        </label>
        <label className="block">
          <span className="label-xs">Reward pool ($FACTS)</span>
          <input
            type="number"
            className={field}
            value={draft.rewardPool}
            onChange={(e) => setDraft({ ...draft, rewardPool: Number(e.target.value) })}
          />
        </label>

        <button
          type="button"
          className="fa-btn"
          onClick={() => {
            configure(draft);
            setSaved(true);
          }}
        >
          <Settings className="size-4" /> {saved ? "Season saved" : "Save season"}
        </button>
      </div>
    </Screen>
  );
}
