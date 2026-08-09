/**
 * Battle arena catalogue for FarAction's Three.js backdrops.
 *
 * Purely presentational — arena choice has no effect on match rules or
 * combat math. Colors are plain CSS color strings (hex) so they can be fed
 * straight into three.js `Color` without touching Tailwind tokens.
 */

export type ArenaId = "nexus" | "mountain" | "volcano" | "city" | "forest" | "void";

export interface Arena {
  id: ArenaId;
  name: string;
  blurb: string;
  /** three.js fog color. */
  fog: string;
  /** Ground plane base color. */
  ground: string;
  /** Key/rim light + accent glow color. */
  accent: string;
  /** Sky gradient, top → horizon. */
  sky: [string, string];
}

export const ARENAS: Arena[] = [
  {
    id: "nexus",
    name: "Nexus",
    blurb: "Concentric rings of light around a neutral floating dais.",
    fog: "#141726",
    ground: "#1c2033",
    accent: "#5fd6ff",
    sky: ["#0c0f1c", "#1b2338"],
  },
  {
    id: "mountain",
    name: "Mountain",
    blurb: "Jagged snow ridgelines under a cold, thin sky.",
    fog: "#1c2430",
    ground: "#232c38",
    accent: "#9cc7ff",
    sky: ["#141c2a", "#2a3a4d"],
  },
  {
    id: "volcano",
    name: "Volcano",
    blurb: "Charred cones, a lava floor and drifting embers.",
    fog: "#22120d",
    ground: "#241210",
    accent: "#ff7a3d",
    sky: ["#150a08", "#341510"],
  },
  {
    id: "city",
    name: "City",
    blurb: "A dense skyline of glowing office towers at night.",
    fog: "#12151f",
    ground: "#181c27",
    accent: "#ff4fa3",
    sky: ["#0a0c14", "#1a1c2c"],
  },
  {
    id: "forest",
    name: "Forest",
    blurb: "Dark pines, soft fog and slow drifting motes.",
    fog: "#131d16",
    ground: "#182419",
    accent: "#7fdc8f",
    sky: ["#0c140e", "#1a2a1d"],
  },
  {
    id: "void",
    name: "Void",
    blurb: "Endless black with rotating shards of broken light.",
    fog: "#08080d",
    ground: "#0c0c13",
    accent: "#b98dff",
    sky: ["#050508", "#0e0e18"],
  },
];

export function getArena(id: string | null | undefined): Arena {
  return ARENAS.find((a) => a.id === id) ?? ARENAS[0]!;
}
