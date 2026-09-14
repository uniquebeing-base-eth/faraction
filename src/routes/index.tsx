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
  Home,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePlayer, passIsActive, displayHandle } from "@/lib/game/store";
import { randomFact, CHARACTERS } from "@/lib/game/gameData";
import { GameWorld } from "@/components/GameWorld";
import { SeasonIntroScene } from "@/components/SeasonIntroScene";
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

const NAV_ITEMS = [
  { to: "/", label: "Home", Icon: Home, active: true },
  { to: "/create-match", label: "Fight", Icon: Swords },
  { to: "/leaderboard", label: "Leaderboard", Icon: Trophy },
  { to: "/loadout", label: "Cards", Icon: PlusCircle },
  { to: "/select-fighter", label: "Roster", Icon: Users },
  { to: "/market", label: "Market", Icon: Store },
] as const;

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
  const [featured, setFeatured] = useState(() => FEATURED.findIndex((f) => f.id === "noxar"));

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
  const hero = CHARACTERS.find((fighter) => fighter.id === player.fighterId) ?? CHARACTERS[0]!;
  const heroArt = hero.fullArt || hero.standingArt || hero.portrait || "";
  const heroAlt = `${hero.name} fighter artwork`;

  return (
    <main className="fa-screen overflow-hidden bg-[#050915] text-white">
      <SeasonIntroScene className="z-0 opacity-80" accent="#d08cff" />
      <GameWorld dim={0.28} />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(192,114,255,0.22),transparent_30%),radial-gradient(circle_at_30%_60%,rgba(64,141,255,0.12),transparent_35%),linear-gradient(180deg,#050915_0%,#080d16_100%)]" />
      <div className="absolute inset-0 opacity-70">
        <div className="absolute -left-24 top-24 h-[460px] w-[460px] rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute right-8 bottom-20 h-[520px] w-[520px] rounded-full bg-violet-600/12 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,transparent,rgba(15,17,26,0.9))]" />
      </div>

      <aside className="absolute inset-y-0 left-0 z-30 flex w-[92px] flex-col items-center border-r border-white/10 bg-[#050914]/80 px-2 py-5 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <Link to="/" className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80">
          <span className="flex flex-col gap-1">
            <span className="h-0.5 w-5 rounded-full bg-current" />
            <span className="h-0.5 w-5 rounded-full bg-current" />
            <span className="h-0.5 w-5 rounded-full bg-current" />
          </span>
        </Link>

        <div className="flex w-full flex-col items-center gap-3">
          {NAV_ITEMS.map(({ to, label, Icon, active }) => (
            <Link
              key={label}
              to={to}
              className={`flex w-[76px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-[10px] font-display uppercase tracking-[0.18em] ${
                active
                  ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-200 shadow-[0_0_18px_rgba(192,114,255,0.45)]"
                  : "border-transparent bg-transparent text-white/60 hover:border-white/10 hover:text-white"
              }`}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          ))}
        </div>

        <Link to="/profile" className="mt-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80">
          <Settings className="size-5" />
        </Link>
      </aside>

      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-8 py-6 pl-[118px]">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <span className="font-display text-[38px] font-black italic leading-none tracking-[-0.08em] text-white">
              FAR
              <span className="text-fuchsia-400">ACTION</span>
            </span>
            <div className="ml-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/50 bg-fuchsia-500/10 px-3 py-1 font-display text-[10px] uppercase tracking-[0.18em] text-fuchsia-200">
              <span className="text-fuchsia-300">SEASON 2</span>
            </div>
          </div>
          <div className="font-display text-[18px] uppercase italic tracking-[0.18em] text-fuchsia-300">
            THE RISE OF JUNKIES
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-cyan-400/50 bg-cyan-500/10 px-4 py-2 text-cyan-200 shadow-[0_0_18px_rgba(45,212,191,0.2)]">
            <span className="font-display text-[11px] uppercase tracking-[0.18em]">FACTS</span>
            <span className="font-display text-lg font-bold">{Math.max(0, Math.floor(player.fp)).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-violet-400/50 bg-violet-500/10 px-3 py-2 text-violet-200">
            <img src={hero.portrait || heroArt} alt="" className="h-8 w-8 rounded-full border border-white/20 object-cover" />
            <span className="font-display text-[11px] uppercase tracking-[0.18em]">{displayHandle(player)}</span>
          </div>
        </div>
      </header>

      <div className="absolute inset-0 z-10 pl-[116px] pb-[76px] pt-[90px]">
        <div className="relative h-full w-full">
          <div className="absolute left-6 top-4 max-w-[560px]">
            <p className="label-xs text-fuchsia-300">SEASON 2</p>
            <h1 className="mt-2 font-display text-[84px] uppercase leading-[0.76] tracking-[-0.09em] text-white drop-shadow-[0_0_24px_rgba(232,121,249,0.65)]">
              <span className="block text-[0.78em] text-fuchsia-200">THE RISE OF</span>
              <span className="block text-fuchsia-400 [text-shadow:0_0_18px_rgba(217,70,239,0.9)]">JUNKIES</span>
            </h1>
            <p className="mt-5 max-w-[350px] text-[13px] uppercase tracking-[0.12em] text-white/55">
              CORRUPTION BREEDS POWER.<br />THE ARENA AWAITS.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/select-fighter" className="inline-flex items-center gap-3 rounded-xl border border-fuchsia-400/70 bg-[linear-gradient(90deg,rgba(142,84,255,0.24),rgba(74,227,255,0.13))] px-6 py-3 text-[13px] font-display font-bold uppercase tracking-[0.14em] text-fuchsia-100 shadow-[0_0_22px_rgba(216,180,254,0.5)]">
                <Swords className="size-4" />
                ENTER THE ARENA
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link to="/join-match" className="inline-flex items-center gap-2 rounded-full border border-cyan-400/60 bg-cyan-500/10 px-3 py-2 text-[10px] font-display uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.16)]">
                <LogIn className="size-3.5" />
                Join Match
              </Link>
              <Link to="/season-pass" className="inline-flex items-center gap-2 rounded-full border border-violet-400/60 bg-violet-500/10 px-3 py-2 text-[10px] font-display uppercase tracking-[0.18em] text-violet-100 shadow-[0_0_18px_rgba(168,85,247,0.18)]">
                <ShieldCheck className="size-3.5" />
                Season Pass
              </Link>
            </div>

            <div className="mt-5 grid max-w-[500px] grid-cols-3 gap-2">
              {[
                {
                  label: "House streak",
                  value: `${player.houseStreak}/5`,
                  hint: "verified boss run",
                  icon: Crown,
                },
                {
                  label: "Verified wins",
                  value: String(player.wins),
                  hint: "arena results",
                  icon: ShieldCheck,
                },
                {
                  label: "Prize pool",
                  value: formatFacts(season.rewardPool),
                  hint: "season reward",
                  icon: Sparkles,
                },
              ].map(({ label, value, hint, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-[rgba(10,12,18,0.62)] p-2.5">
                  <div className="flex items-center justify-between gap-2 text-white/55">
                    <span className="font-display text-[9px] uppercase tracking-[0.18em]">{label}</span>
                    <Icon className="size-3.5 text-fuchsia-200" />
                  </div>
                  <div className="mt-2 font-display text-[20px] leading-none tracking-[-0.06em] text-white">{value}</div>
                  <div className="mt-1 text-[8px] uppercase tracking-[0.18em] text-white/45">{hint}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute inset-x-[18%] bottom-0 top-[18px] flex items-end justify-center">
            <div className="relative h-[82%] w-[840px]">
              <span className="fa-smoke left-[12%] top-[16%] h-56 w-56" />
              <span className="fa-smoke right-[16%] top-[18%] h-64 w-64" />
              <div className="absolute inset-x-[8%] bottom-8 h-[200px] rounded-full bg-fuchsia-500/20 blur-3xl" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(circle_at_center,rgba(156,81,255,0.28),transparent_60%)]" />
              <img
                loading="eager"
                decoding="async"
                fetchPriority="high"
                key={hero.id}
                src={heroArt}
                alt={heroAlt}
                className="absolute inset-x-0 bottom-0 mx-auto h-[570px] w-[640px] object-contain object-bottom drop-shadow-[0_26px_80px_rgba(192,114,255,0.45)]"
              />
            </div>
          </div>

          <aside className="absolute right-6 top-4 w-[290px] rounded-[28px] border border-fuchsia-400/40 bg-[#070d1a]/80 p-4 shadow-[0_0_0_1px_rgba(192,114,255,0.2),0_22px_60px_rgba(59,12,84,0.7)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-fuchsia-300">
                <span className="font-display text-[11px] uppercase tracking-[0.18em]">{hero.className ?? "VANGUARD"}</span>
              </div>
              <div className="rounded-full border border-fuchsia-400/50 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-display uppercase tracking-[0.18em] text-fuchsia-100">
                {hero.name}
              </div>
            </div>

            <div className="mt-4 text-center">
              <div className="font-display text-[42px] uppercase leading-none tracking-[-0.08em] text-white">{hero.name}</div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[
                { label: "KNOCK", value: hero.knockStat ?? 0 },
                { label: "PRIORITY", value: hero.priorityStat ?? 0 },
                { label: "DRAIN", value: hero.drainStat ?? 0 },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-white/70"
                >
                  <span className="text-white/45">{stat.label}</span>
                  <span className="font-display text-[13px] font-bold text-fuchsia-200">{stat.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/8 p-3">
              <div className="flex items-center gap-2 text-fuchsia-200">
                <span className="font-display text-[11px] uppercase tracking-[0.18em]">{hero.passive?.name ?? "Passive"}</span>
              </div>
              <div className="mt-2 text-xs text-white/70">{hero.passive?.description ?? "Pressure and precision control the fight."}</div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                [hero.ultimate?.name ?? "Finale", "ULTIMATE"],
                [hero.passive?.name ?? "Pressure", "PASSIVE"],
                [hero.className ?? "CLASS", "ROLE"],
              ].map(([name, kind]) => (
                <div key={`${name}-${kind}`} className="rounded-2xl border border-white/10 bg-white/5 p-2 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-200">
                    <Zap className="size-4" />
                  </div>
                  <div className="font-display text-[10px] uppercase tracking-[0.14em] text-white/70">{name}</div>
                  <div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-white/45">{kind}</div>
                </div>
              ))}
            </div>
          </aside>

          <div className="absolute inset-x-0 bottom-0 z-30 flex items-end justify-center px-6 pb-2">
            <div className="grid w-full max-w-[1180px] grid-cols-4 gap-4">
              {[
                { label: "FIGHTERS", sub: "VIEW & SELECT", to: "/select-fighter", icon: Users },
                { label: "CARDS", sub: "BUILD YOUR DECK", to: "/loadout", icon: PlusCircle },
                { label: "ARENAS", sub: "ENTER THE BATTLE", to: "/create-match", icon: Swords },
                { label: "MARKET", sub: "BUY & SELL", to: "/market", icon: Store },
              ].map(({ label, sub, to, icon: Icon }) => (
                <Link
                  key={label}
                  to={to}
                  className="group flex items-center justify-between rounded-[22px] border border-fuchsia-400/40 bg-[linear-gradient(180deg,rgba(29,17,41,0.8),rgba(10,12,18,0.88))] p-4 text-left shadow-[0_0_18px_rgba(168,85,247,0.18)] transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-fuchsia-300/40 bg-fuchsia-500/10 text-fuchsia-200">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <div className="font-display text-[22px] leading-none tracking-[0.08em] text-white">{label}</div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-fuchsia-200/80">{sub}</div>
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-fuchsia-200 opacity-80 transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

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
