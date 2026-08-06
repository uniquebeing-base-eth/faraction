import type { ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { GameWorld } from "@/components/GameWorld";

/**
 * Shared landscape screen shell: world backdrop + HUD overlay + a left brief
 * rail and a right content surface. Used by every non-arena screen so they
 * feel like stations inside the game world instead of stacked dashboards.
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
    <main className="fa-screen">
      <GameWorld image={image} dim={0.62} />
      <TopBar title={title} back={back} />
      <div className="relative z-10 grid h-full grid-cols-[400px_minmax(0,1fr)] gap-8 px-8 pt-20 pb-7">
        <section className="flex min-h-0 flex-col">
          <p className="label-xs text-accent">{eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] font-bold">{heading}</h1>
          {blurb ? (
            <p className="mt-3 max-w-[34ch] text-sm text-muted-foreground">{blurb}</p>
          ) : null}
          {aside ? <div className="mt-5 min-h-0 flex-1">{aside}</div> : null}
        </section>
        <section className="panel min-h-0 overflow-hidden p-5">{children}</section>
      </div>
    </main>
  );
}
