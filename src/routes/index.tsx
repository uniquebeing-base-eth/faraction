import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Zap,
  Trophy,
  Users,
  Swords,
  Crown,
  Store,
  BookOpen,
  ChevronRight,
  PlusCircle,
  LogIn,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePlayer, passIsActive } from "@/lib/game/store";
import { randomFact, CHARACTERS } from "@/lib/game/gameData";
import { GameWorld } from "@/components/GameWorld";
import { TopBar } from "@/components/TopBar";
import squadGenesisAssetPointer from "@/assets/img/squad-genesis.webp.asset.json";
import { cdnAsset } from "@/lib/assets";
const squadGenesisAsset = cdnAsset(squadGenesisAssetPointer.url);
import { useSeason, formatFacts } from "@/lib/game/season";
import { ActivityTicker } from "@/components/ActivityTicker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FarAction — Onchain Card Fighting on Base" },
      {
        name: "description",
        content:
          "FarAction is a Farcaster Mini App fighting card game on Base. Create a match, stake FACTS or USDC, beat the House, and claim the pot.",
      },
      { property: "og:title", content: "FarAction — Onchain Card Fighting on Base" },
      {
        property: "og:description",
        content: "Create or join staked card battles on Base. Winner takes 90% of the pot.",
      },
      { property: "og:url", content: "/" },
      { property: "og:image", content: "https://faraction.signalify.xyz/image.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://faraction.signalify.xyz/image.jpg" },
      {
        name: "fc:miniapp",
        content: JSON.stringify({
          version: "1",
          imageUrl: "https://faraction.signalify.xyz/image.jpg",
          button: {
            title: "Launch FarAction",
            action: {
              type: "launch_miniapp",
              name: "FarAction",
              url: "https://faraction.signalify.xyz",
              splashImageUrl: "https://faraction.signalify.xyz/splash.png",
              splashBackgroundColor: "#0a0f16",
            },
          },
        }),
      },
      {
        name: "fc:frame",
        content: JSON.stringify({
          version: "1",
          imageUrl: "https://faraction.signalify.xyz/image.jpg",
          button: {
            title: "Launch FarAction",
            action: {
              type: "launch_frame",
              name: "FarAction",
              url: "https://faraction.signalify.xyz",
              splashImageUrl: "https://faraction.signalify.xyz/splash.png",
              splashBackgroundColor: "#0a0f16",
            },
          },
        }),
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

const BASE_FACT_PLACEHOLDER =
  "Base is an Ethereum L2 incubated by Coinbase, built on the OP Stack.";

/**
 * Featured hero rotation. Add an entry here to spotlight a new fighter — the
 * home page cycles through the list and needs no other change.
 */
const FEATURED: { id: string; art: string; name: string; tag: string; alt: string }[] = [
  {
    id: "squad",
    art: squadGenesisAsset,
    name: "THE SQUAD",
    tag: "Season 1 · Genesis roster",
    alt: "The FarAction Genesis squad standing together in the arena",
  },
  ...CHARACTERS.map((c) => ({
    id: c.id,
    art: c.fullArt,
    name: c.name,
    tag: `${c.className} class`,
    alt: `${c.name}, ${c.className} class fighter in the FarAction arena`,
  })),
];

const STATIONS = [
  {
    to: "/leaderboard",
    label: "Leaderboard",
    note: "Season 1 · Genesis standings",
    Icon: Trophy,
    tint: "text-facts",
  },
  {
    to: "/profile",
    label: "Profile",
    note: "Record & Base codex",
    Icon: BookOpen,
    tint: "text-accent",
  },
  {
    to: "/market",
    label: "Black Market",
    note: "Premium cards",
    Icon: Store,
    tint: "text-control",
  },
] as const;

function Landing() {
  const { player } = usePlayer();
  const { config: season, status } = useSeason();
  const [fact, setFact] = useState(BASE_FACT_PLACEHOLDER);
  const [featured, setFeatured] = useState(0);

  useEffect(() => {
    setFact(randomFact());
    const t = setInterval(() => setFact(randomFact()), 7000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setFeatured((i) => (i + 1) % FEATURED.length), 9000);
    return () => clearInterval(t);
  }, []);

  const pass = passIsActive(player);
  const hero = FEATURED[featured]!;

  return (
    <main className="fa-screen">
      <GameWorld dim={0.45} />

      {/* Featured fighter, centre stage */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[5] w-[620px] -translate-x-[58%]">
        <div className="fa-pedestal absolute inset-x-0 bottom-14 h-56" />
        <img
          loading="eager"
          decoding="async"
          fetchPriority="high"
          key={hero.id}
          src={hero.art}
          alt={hero.alt}
          className="fa-art animate-float absolute bottom-16 left-1/2 h-[600px] -translate-x-1/2 object-contain object-bottom"
        />
      </div>

      <TopBar />

      <div className="relative z-10 grid h-full grid-cols-[520px_minmax(0,1fr)_320px] gap-6 px-8 pt-20 pb-6">
        {/* Left — identity + primary actions */}
        <section className="flex flex-col justify-center">
          <p className="label-xs text-accent">
            {season.name} · {status.ended ? "Ended" : "Live"}
          </p>
          <p className="label-xs mt-1 text-muted-foreground">
            {status.ended
              ? "Leaderboard locked · rewards claimable"
              : `Ends in ${status.parts.days}d ${status.parts.hours}h ${status.parts.minutes}m ${status.parts.seconds}s`}
          </p>
          <h1 className="mt-2 font-display text-[70px] leading-[0.9] font-bold tracking-tight">
            FAR<span className="text-accent">ACTION</span>
          </h1>
          <p className="mt-3 max-w-[42ch] text-sm font-semibold leading-relaxed text-foreground/90">
            Onchain card fighting on Base. Lock a five-slot sequence, reveal it against the House AI
            or a rival, and stack FACTS toward the 100,000,000 $FACTS season reward pool.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to="/create-match" className="fa-btn">
              <PlusCircle className="size-4" />
              Create Match
            </Link>
            <Link to="/join-match" className="fa-btn-ghost">
              <LogIn className="size-4" />
              Join Match
            </Link>
            <Link to="/select-fighter" className="fa-btn-ghost">
              <Swords className="size-4" />
              Enter Arena
            </Link>
            <Link to="/loadout" className="fa-btn-ghost">
              <Users className="size-4" />
              Quick Match
            </Link>
          </div>

          <Link
            to="/house-boss"
            className="panel animate-ring mt-5 flex max-w-[500px] items-center gap-4 p-4 transition-transform hover:-translate-y-0.5"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-facts/40 bg-facts/10">
              <Crown className="size-5 text-facts" />
            </span>
            <span className="min-w-0">
              <span className="label-xs block text-facts">Season reward pool</span>
              <span className="block font-display text-lg font-bold">
                {season.rewardPool.toLocaleString()} $FACTS
              </span>
              <span className="block text-[11px] font-semibold text-muted-foreground/90">
                Top 25 split the pool — #1 takes {formatFacts(20_000_000)} FACTS
              </span>
            </span>
            <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </Link>

          {/* Roster rotation rail */}
          <div className="mt-5 flex items-center gap-2">
            <span className="label-xs shrink-0">Roster</span>
            {FEATURED.map((f, i) => (
              <button
                key={f.id}
                type="button"
                aria-label={`Feature ${f.name}`}
                onClick={() => setFeatured(i)}
                className={`h-11 w-11 overflow-hidden rounded-md border transition-all ${
                  i === featured
                    ? "border-accent glow"
                    : "border-border/60 opacity-55 hover:opacity-90"
                }`}
              >
                <img
                  loading="lazy"
                  decoding="async"
                  src={f.art}
                  alt=""
                  className="size-full object-cover object-top"
                />
              </button>
            ))}
          </div>
        </section>

        <div className="flex items-end justify-center pb-8">
          <div className="panel pointer-events-none px-5 py-2 text-center">
            <p className="label-xs text-accent">{hero.tag}</p>
            <p className="font-display text-xl font-bold tracking-wide">{hero.name}</p>
          </div>
        </div>

        {/* Right — station rail */}
        <aside className="flex flex-col justify-center gap-2.5">
          <p className="label-xs text-[11px]">Arena stations</p>
          {STATIONS.map(({ to, label, note, Icon, tint }) => (
            <Link
              key={to}
              to={to}
              className="panel group flex items-center gap-3 p-3.5 transition-transform hover:-translate-y-0.5"
            >
              <Icon className={`size-4 shrink-0 ${tint}`} />
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-extrabold leading-tight">{label}</span>
                <span className="mt-0.5 block text-[12px] font-semibold text-muted-foreground/90">{note}</span>
              </span>
              <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}

          <Link
            to="/season-pass"
            className={`flex items-center gap-3 rounded-lg border p-3.5 backdrop-blur-md transition-transform hover:-translate-y-0.5 ${
              pass ? "border-facts/60 bg-facts/15" : "border-facts/35 bg-facts/5"
            }`}
          >
            <Zap className="size-4 shrink-0 text-facts" />
            <span className="min-w-0">
              <span className="block font-display text-[15px] font-extrabold leading-tight text-facts">
                {pass ? "Pass Active" : "Season Pass"}
              </span>
              <span className="mt-0.5 block text-[12px] font-semibold text-muted-foreground/90">
                {pass
                  ? "Ranked + leaderboard unlocked"
                  : "Required for Ranked & the 100M $FACTS pool"}
              </span>
            </span>
          </Link>

          <div className="panel mt-1 grid grid-cols-3 gap-2 p-3 text-center">
            {(
              [
                ["Wins", String(player.wins)],
                ["Losses", String(player.losses)],
                ["Streak", `${player.houseStreak}/5`],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <p className="label-xs">{k}</p>
                <p className="font-display text-base font-bold">{v}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Bottom rail — live ecosystem ticker + Base codex */}
      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-border/50 bg-background/70 backdrop-blur-md">
        <div className="flex items-center gap-3 px-8 py-2">
          <span className="label-xs shrink-0 text-facts">Live</span>
          <span className="h-3 w-px shrink-0 bg-border" />
          <ActivityTicker />
        </div>
        <div className="flex items-center gap-3 border-t border-border/40 px-8 py-2">
          <span className="label-xs shrink-0 text-accent">Base codex</span>
          <span className="h-3 w-px shrink-0 bg-border" />
          <p key={fact} className="animate-slam truncate text-xs text-foreground/85">
            {fact}
          </p>
        </div>
      </div>
    </main>
  );
}
