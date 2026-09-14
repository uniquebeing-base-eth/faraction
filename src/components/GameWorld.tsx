import arenaPointer from "@/assets/img/arena.jpg.asset.json";
import { cdnAsset } from "@/lib/assets";
const arena = cdnAsset(arenaPointer);

/**
 * Ambient arena world: depth-layered backdrop used behind every screen so the
 * UI reads as an overlay on a living 3D-ish space rather than a page.
 */
export function GameWorld({
  image = arena,
  dim = 0.55,
  beams = true,
  motes = true,
}: {
  image?: string | undefined;
  dim?: number;
  beams?: boolean;
  motes?: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        loading="eager"
        decoding="async"
        src={image}
        alt=""
        aria-hidden
        className="fa-world-parallax absolute inset-0 size-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, color-mix(in oklab, var(--background) ${dim * 100}%, transparent) 0%, color-mix(in oklab, var(--background) ${Math.min(dim + 0.3, 1) * 100}%, transparent) 55%, var(--background) 100%)`,
        }}
      />
      <div className="fa-horizon absolute inset-x-0 top-1/2 h-px" />
      <div className="grid-floor fa-floor absolute inset-x-0 bottom-0 h-[46%] opacity-40" />
      {beams ? (
        <>
          <div className="fa-beam fa-beam-a" />
          <div className="fa-beam fa-beam-b" />
        </>
      ) : null}
      {motes ? (
        <div className="fa-motes absolute inset-0">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 7.3 + 4) % 98}%`,
                animationDelay: `${(i % 7) * 1.4}s`,
                animationDuration: `${11 + (i % 5) * 3}s`,
              }}
            />
          ))}
        </div>
      ) : null}
      <div className="fa-vignette absolute inset-0" />
      <div className="fa-scanlines absolute inset-0" />
    </div>
  );
}
