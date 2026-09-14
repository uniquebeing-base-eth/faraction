import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Home, Swords, PlusCircle, Users, Store, Trophy } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { GameWorld } from "@/components/GameWorld";

const NAV_ITEMS = [
  { to: "/", label: "Home", Icon: Home, active: false },
  { to: "/create-match", label: "Fight", Icon: Swords, active: false },
  { to: "/leaderboard", label: "Leaderboard", Icon: Trophy, active: false },
  { to: "/loadout", label: "Cards", Icon: PlusCircle, active: false },
  { to: "/select-fighter", label: "Roster", Icon: Users, active: false },
  { to: "/market", label: "Market", Icon: Store, active: false },
] as const;

/**
 * Shared Season 2 shell used across the app: the same world backdrop and
 * navigation treatment as the home screen, but with a content panel layout for
 * active game stations like Match, Cards, Market and Roster.
 */
export function Screen({
  title,
  back = "/",
  eyebrow,
  heading,
  blurb,
  aside,
  children,
  image,
}: {
  title: string;
  back?: string;
  eyebrow: string;
  heading: string;
  blurb?: string;
  aside?: ReactNode;
  children: ReactNode;
  image?: string | undefined;
}) {
  return (
    <main className="fa-screen overflow-hidden bg-[#050915] text-white">
      <GameWorld image={image} dim={0.62} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(192,114,255,0.18),transparent_30%),radial-gradient(circle_at_80%_65%,rgba(59,130,246,0.12),transparent_32%),linear-gradient(180deg,#050915_0%,#080d16_100%)]" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-8 h-[440px] w-[440px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute right-16 top-20 h-[300px] w-[300px] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.25),transparent_60%)]" />
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
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <Link
              key={label}
              to={to}
              className={`flex w-[76px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-[10px] font-display uppercase tracking-[0.18em] ${
                to === "/" || title.toLowerCase().includes(label.toLowerCase())
                  ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-200 shadow-[0_0_18px_rgba(192,114,255,0.45)]"
                  : "border-transparent bg-transparent text-white/60 hover:border-white/10 hover:text-white"
              }`}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </aside>

      <TopBar title={title} back={back} />

      <div className="absolute inset-0 z-10 pl-[116px] pt-[88px] pb-[28px]">
        <div className="relative h-full w-full rounded-[30px] border border-fuchsia-400/30 bg-[#090d18]/70 p-6 shadow-[0_0_40px_rgba(168,85,247,0.16)] backdrop-blur-sm">
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/80 to-transparent" />
          <div className="grid h-full grid-cols-[360px_minmax(0,1fr)] gap-6">
            <section className="flex min-h-0 flex-col">
              <p className="label-xs text-fuchsia-300">{eyebrow}</p>
              <h1 className="mt-2 font-display text-[52px] uppercase leading-[0.9] tracking-[-0.08em] text-white drop-shadow-[0_0_20px_rgba(232,121,249,0.4)]">
                {heading}
              </h1>
              {blurb ? (
                <p className="mt-3 max-w-[32ch] text-[13px] uppercase tracking-[0.12em] text-white/60">{blurb}</p>
              ) : null}
              {aside ? <div className="mt-5 min-h-0 flex-1">{aside}</div> : null}
            </section>
            <section className="panel min-h-0 overflow-hidden p-5 shadow-[0_0_0_1px_rgba(192,114,255,0.15),0_22px_60px_rgba(80,25,110,0.3)]">{children}</section>
          </div>
        </div>
      </div>
    </main>
  );
}
