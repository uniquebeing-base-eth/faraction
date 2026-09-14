// FarAction — card & fighter definitions.
// Mechanics preserved from the original engine; content rebranded to Base.
import { cdnAsset } from "@/lib/assets";
import kairaAssetPointer from "@/assets/img/fighter-kaira-v3.png.asset.json";
const kairaAsset = cdnAsset(kairaAssetPointer);
import kenjiAssetPointer from "@/assets/img/fighter-kenji-v3.webp.asset.json";
const kenjiAsset = cdnAsset(kenjiAssetPointer);
import rivenAssetPointer from "@/assets/img/fighter-riven-v3.webp.asset.json";
const rivenAsset = cdnAsset(rivenAssetPointer);
import zaneAssetPointer from "@/assets/img/fighter-zane-v3.webp.asset.json";
const zaneAsset = cdnAsset(zaneAssetPointer);
import elaraAssetPointer from "@/assets/img/fighter-elara-v3.webp.asset.json";
const elaraAsset = cdnAsset(elaraAssetPointer);
import cinderAssetPointer from "@/assets/img/fighter-cinder-v3.webp.asset.json";
const cinderAsset = cdnAsset(cinderAssetPointer);
import goblynAssetPointer from "@/assets/img/fighter-goblyn-v3.png.asset.json";
const goblynAsset = cdnAsset(goblynAssetPointer);
import noxarAssetPointer from "@/assets/img/fighter-noxar-v3.png.asset.json";
const noxarAsset = cdnAsset(noxarAssetPointer);
import azelAssetPointer from "@/assets/img/fighter-azel-v3.webp.asset.json";
const azelAsset = cdnAsset(azelAssetPointer);
import pipAssetPointer from "@/assets/img/fighter-pip-v3.png.asset.json";
const pipAsset = cdnAsset(pipAssetPointer);

import strikeAssetPointer from "@/assets/img/card-strike.jpg.asset.json";
const strikeAsset = cdnAsset(strikeAssetPointer);
import defenseAssetPointer from "@/assets/img/card-defense.jpg.asset.json";
const defenseAsset = cdnAsset(defenseAssetPointer);
import controlAssetPointer from "@/assets/img/card-control.jpg.asset.json";
const controlAsset = cdnAsset(controlAssetPointer);

const kairaArt = kairaAsset;
const kenjiArt = kenjiAsset;
const rivenArt = rivenAsset;
const zaneArt = zaneAsset;
const elaraArt = elaraAsset;
const cinderArt = cinderAsset;
const goblynArt = goblynAsset;
const noxarArt = noxarAsset;
const azelArt = azelAsset;
const pipArt = pipAsset;

const strikeArt = strikeAsset;
const defenseArt = defenseAsset;
const controlArt = controlAsset;


export type CardType = "strike" | "defense" | "control";

export interface Card {
  id: string;
  name: string;
  type: CardType;
  priority: number;
  knock: number;
  energyCost: number;
  effect: string;
  color: string;
  bgColor: string;
  image: string;
  isWild?: boolean;
  isPremium?: boolean;
  rarity?: string;
  price?: number;
}

export interface Character {
  id: string;
  name: string;
  className: string;
  knockStat: number;
  priorityStat: number;
  drainStat: number;
  portrait: string;
  fullArt: string;
  standingArt: string;
  color: string;
  isLocked?: boolean;
  passive?: { name: string; description: string };
  ultimate?: {
    name: string;
    description: string;
    effect: "guaranteed_crit" | "double_knock" | "full_dodge" | "drain_debuff" | "priority_surge";
  };
  taunts?: string[];
}

export const CARD_ART: Record<CardType, string> = {
  strike: strikeArt,
  defense: defenseArt,
  control: controlArt,
};

export const CHARACTERS: Character[] = [
  {
    id: "kaira",
    name: "KAIRA",
    className: "Vanguard",
    knockStat: 85,
    priorityStat: 62,
    drainStat: 40,
    portrait: kairaArt,
    fullArt: kairaArt,
    standingArt: kairaArt,
    color: "#22d3ee",
    isLocked: false,
    passive: { name: "First Strike", description: "+2 Knock on the opening slot" },
    ultimate: {
      name: "Blinding Flash",
      description: "Next slot guaranteed critical hit (2x knock)",
      effect: "guaranteed_crit",
    },
    taunts: ["You can't keep up with me.", "First strike, last words.", "I've already won."],
  },
  {
    id: "kenji",
    name: "KENJI",
    className: "Ronin",
    knockStat: 78,
    priorityStat: 80,
    drainStat: 55,
    portrait: kenjiArt,
    fullArt: kenjiArt,
    standingArt: kenjiArt,
    color: "#0052ff",
    isLocked: false,
    passive: { name: "Blade Speed", description: "+2 Knock when winning a priority clash" },
    ultimate: {
      name: "Blade Storm",
      description: "Double knock damage on next slot",
      effect: "double_knock",
    },
    taunts: ["Draw your blade — if you dare.", "Speed is the only truth.", "Onchain and unbeaten."],
  },
  {
    id: "riven",
    name: "RIVEN",
    className: "Shadow",
    knockStat: 70,
    priorityStat: 90,
    drainStat: 50,
    portrait: rivenArt,
    fullArt: rivenArt,
    standingArt: rivenArt,
    color: "#a855f7",
    isLocked: false,
    passive: { name: "Phantom Dodge", description: "Halve all damage received on slot 3" },
    ultimate: {
      name: "Phase Shift",
      description: "Take zero damage on next slot",
      effect: "full_dodge",
    },
    taunts: [
      "You can't hit what you can't see.",
      "A shadow leaves no trace.",
      "Your moves are already countered.",
    ],
  },
  {
    id: "zane",
    name: "ZANE",
    className: "Brawler",
    knockStat: 95,
    priorityStat: 45,
    drainStat: 35,
    portrait: zaneArt,
    fullArt: zaneArt,
    standingArt: zaneArt,
    color: "#f87171",
    isLocked: false,
    passive: { name: "Bulldoze", description: "+2 Knock on every Strike type-win" },
    ultimate: {
      name: "Seismic Slam",
      description: "Drain 3 knock from opponent's next slot",
      effect: "drain_debuff",
    },
    taunts: [
      "I don't dodge. I end it.",
      "Try to stop me. I dare you.",
      "Every hit shakes the block.",
    ],
  },
  {
    id: "elara",
    name: "ELARA",
    className: "Void Witch",
    knockStat: 60,
    priorityStat: 75,
    drainStat: 90,
    portrait: elaraArt,
    fullArt: elaraArt,
    standingArt: elaraArt,
    color: "#f906a8",
    isLocked: false,
    passive: {
      name: "Void Drain",
      description: "Drain -1 from opponent's next slot after a Control win",
    },
    ultimate: {
      name: "Void Surge",
      description: "+5 priority on next slot, guaranteeing first-strike advantage",
      effect: "priority_surge",
    },
    taunts: [
      "The void hungers for you.",
      "Every card you play feeds my power.",
      "Resistance is already futile.",
    ],
  },
  {
    id: "cinder",
    name: "CINDER",
    className: "Magma Colossus",
    knockStat: 98,
    priorityStat: 38,
    drainStat: 45,
    portrait: cinderArt,
    fullArt: cinderArt,
    standingArt: cinderArt,
    color: "#fb923c",
    isLocked: false,
    passive: {
      name: "Molten Core",
      description: "+3 Knock on any slot where you take zero damage",
    },
    ultimate: {
      name: "Eruption Cleave",
      description: "Double knock damage on next slot",
      effect: "double_knock",
    },
    taunts: [
      "The mountain does not move for you.",
      "Burn with the block.",
      "Ash is all you leave behind.",
    ],
  },
  {
    id: "goblyn",
    name: "GOBLYN",
    className: "Runeling",
    knockStat: 55,
    priorityStat: 68,
    drainStat: 95,
    portrait: goblynArt,
    fullArt: goblynArt,
    standingArt: goblynArt,
    color: "#2dd4bf",
    isLocked: false,
    passive: {
      name: "Rune Leech",
      description: "Drain -1 from the opponent on every Control exchange",
    },
    ultimate: {
      name: "Hex Mace",
      description: "Drain 3 knock from opponent's next slot",
      effect: "drain_debuff",
    },
    taunts: ["Hee hee — squishy!", "Runes say you lose.", "Little goblyn, big mace."],
  },
  {
    id: "noxar",
    name: "NOXAR",
    className: "Void Tyrant",
    knockStat: 92,
    priorityStat: 70,
    drainStat: 72,
    portrait: noxarArt,
    fullArt: noxarArt,
    standingArt: noxarArt,
    color: "#a855f7",
    isLocked: false,
    passive: {
      name: "Sixfold Sight",
      description: "+2 Knock whenever you win two exchanges in a row",
    },
    ultimate: {
      name: "Crystal Nova",
      description: "Next slot guaranteed critical hit (2x knock)",
      effect: "guaranteed_crit",
    },
    taunts: [
      "Six eyes. No blind spots.",
      "The void already counted your slots.",
      "Kneel, or be unmade.",
    ],
  },
  {
    id: "azel",
    name: "AZEL",
    className: "Greatsword Duelist",
    knockStat: 82,
    priorityStat: 88,
    drainStat: 48,
    portrait: azelArt,
    fullArt: azelArt,
    standingArt: azelArt,
    color: "#60a5fa",
    isLocked: false,
    passive: {
      name: "Wandering Guard",
      description: "Halve all damage received on slot 2",
    },
    ultimate: {
      name: "Sigil Rush",
      description: "+5 priority on next slot, guaranteeing first-strike advantage",
      effect: "priority_surge",
    },
    taunts: [
      "I only need one swing.",
      "Steel first, questions later.",
      "You picked the wrong road.",
    ],
  },
  {
    id: "pip",
    name: "PIP",
    className: "Tide Shaman",
    knockStat: 62,
    priorityStat: 94,
    drainStat: 66,
    portrait: pipArt,
    fullArt: pipArt,
    standingArt: pipArt,
    color: "#38bdf8",
    isLocked: false,
    passive: {
      name: "Slippery",
      description: "Halve all damage received on the opening slot",
    },
    ultimate: {
      name: "Totem Ward",
      description: "Take zero damage on next slot",
      effect: "full_dodge",
    },
    taunts: ["Pip is fast! Pip is small!", "Cannot catch the tide.", "Spear go poke!"],
  },
];


const S = strikeArt;
const D = defenseArt;
const C = controlArt;

export const CARDS: Card[] = [
  {
    id: "phantom_break",
    name: "Phantom Break",
    type: "strike",
    priority: 2,
    knock: 6,
    energyCost: 2,
    effect: "Phase through defenses with spectral force",
    color: "#fbac4b",
    bgColor: "#421f1b",
    image: S,
  },
  {
    id: "storm_kick",
    name: "Storm Kick",
    type: "strike",
    priority: 3,
    knock: 5,
    energyCost: 2,
    effect: "Lightning-fast aerial kick",
    color: "#f97316",
    bgColor: "#431407",
    image: S,
  },
  {
    id: "power_punch",
    name: "Power Punch",
    type: "strike",
    priority: 1,
    knock: 8,
    energyCost: 3,
    effect: "One clean opening is enough. High knock if the strike connects.",
    color: "#ef4444",
    bgColor: "#450a0a",
    image: S,
  },
  {
    id: "direct_impact",
    name: "Direct Impact",
    type: "strike",
    priority: 4,
    knock: 4,
    energyCost: 1,
    effect: "Direct intent leaves no room to react. Reliable damage if not blocked.",
    color: "#f59e0b",
    bgColor: "#451a03",
    image: S,
  },
  {
    id: "finisher",
    name: "Finisher",
    type: "strike",
    priority: 1,
    knock: 3,
    energyCost: 4,
    effect: "This order ends here. Can only be used when the opponent is vulnerable.",
    color: "#d4a017",
    bgColor: "#5c4813",
    image: S,
  },
  {
    id: "guard_stance",
    name: "Guard Stance",
    type: "defense",
    priority: 2,
    knock: 2,
    energyCost: 1,
    effect: "Stability denies momentum. Blocks low attacks but leaves the head exposed.",
    color: "#60a5ce",
    bgColor: "#1e3a5f",
    image: D,
  },
  {
    id: "stability",
    name: "Stability",
    type: "defense",
    priority: 1,
    knock: 1,
    energyCost: 1,
    effect: "Anticipation defeats brute force. Blocks high strikes and reduces knock.",
    color: "#3b82f6",
    bgColor: "#1e3a5f",
    image: D,
  },
  {
    id: "reversal_edge",
    name: "Reversal Edge",
    type: "defense",
    priority: 3,
    knock: 3,
    energyCost: 3,
    effect: "Reflect incoming strike damage back",
    color: "#06b6d4",
    bgColor: "#164e63",
    image: D,
  },
  {
    id: "anticipation",
    name: "Anticipation",
    type: "defense",
    priority: 5,
    knock: 3,
    energyCost: 1,
    effect: "Anticipation defeats brute force. Blocks high strikes and reduces knock.",
    color: "#22d3ee",
    bgColor: "#083344",
    image: D,
  },
  {
    id: "mind_game",
    name: "Mind Game",
    type: "control",
    priority: 4,
    knock: 3,
    energyCost: 2,
    effect: "The threat you fear is never the real one. Baits blocks and disrupts reads.",
    color: "#a855f7",
    bgColor: "#3b0764",
    image: C,
  },
  {
    id: "evasion",
    name: "Evasion",
    type: "control",
    priority: 5,
    knock: 2,
    energyCost: 1,
    effect: "Absence is the cleanest defense. Avoids damage but applies no pressure.",
    color: "#8b5cf6",
    bgColor: "#2e1065",
    image: C,
  },
  {
    id: "pressure_advance",
    name: "Pressure Advance",
    type: "control",
    priority: 3,
    knock: 5,
    energyCost: 2,
    effect: "Advance without striking. Forces a response and disrupts timing.",
    color: "#c084fc",
    bgColor: "#581c87",
    image: C,
  },
  {
    id: "disrupt",
    name: "Disrupt",
    type: "control",
    priority: 2,
    knock: 4,
    energyCost: 2,
    effect: "Turn their force against them. Triggers only against an incoming strike.",
    color: "#d946ef",
    bgColor: "#701a75",
    image: C,
  },
  {
    id: "berserk_surge",
    name: "Berserk Surge",
    type: "strike",
    priority: 1,
    knock: 9,
    energyCost: 3,
    effect: "Consumed by fury. Strikes with catastrophic, unyielding force.",
    color: "#ef4444",
    bgColor: "#450a0a",
    image: S,
  },
  {
    id: "run_away",
    name: "Run Away",
    type: "control",
    priority: 5,
    knock: 2,
    energyCost: 1,
    effect: "A swift, desperate dash. Disengage from combat instantly.",
    color: "#38bdf8",
    bgColor: "#0c2340",
    image: C,
  },
  {
    id: "inner_focus",
    name: "Inner Focus",
    type: "control",
    priority: 3,
    knock: 6,
    energyCost: 2,
    effect: "Channel inner power into a vortex of unassailable force.",
    color: "#4ade80",
    bgColor: "#052e16",
    image: C,
  },
  {
    id: "javelin_dive",
    name: "Javelin Dive",
    type: "strike",
    priority: 2,
    knock: 5,
    energyCost: 2,
    effect: "An unstoppable human javelin. Guarantees piercing damage.",
    color: "#93c5fd",
    bgColor: "#1e3a5f",
    image: S,
  },
  {
    id: "aerial_spear_fist",
    name: "Aerial Spear-Fist",
    type: "strike",
    priority: 2,
    knock: 8,
    energyCost: 3,
    effect: "Descends like a bolt of thunder. Shatters guards.",
    color: "#f97316",
    bgColor: "#431407",
    image: S,
  },

  // Black Market (premium) cards — priced in FACTS
  {
    id: "rko",
    name: "RKO",
    type: "strike",
    priority: 7,
    knock: 11,
    energyCost: 4,
    effect: "Out of nowhere! Devastating strike with massive priority.",
    color: "#ef4444",
    bgColor: "#450a0a",
    image: S,
    isPremium: true,
    price: 225000,
  },
  {
    id: "go_to_hell",
    name: "Chain Reorg",
    type: "strike",
    priority: 3,
    knock: 15,
    energyCost: 5,
    effect: "Ultimate destructive move. Requires high energy but annihilates opposition.",
    color: "#f97316",
    bgColor: "#431407",
    image: S,
    isPremium: true,
    price: 300000,
  },
  {
    id: "headbutt",
    name: "Headbutt",
    type: "strike",
    priority: 8,
    knock: 7,
    energyCost: 3,
    effect: "A quick, brutal intercept to stagger the opponent.",
    color: "#d946ef",
    bgColor: "#701a75",
    image: S,
    isPremium: true,
    price: 120000,
  },
  {
    id: "darkness_repellent",
    name: "Rollup Shield",
    type: "defense",
    priority: 7,
    knock: 0,
    energyCost: 3,
    effect: "A perfect guard against all but the most unyielding strikes.",
    color: "#8b5cf6",
    bgColor: "#2e1065",
    image: D,
    isPremium: true,
    price: 180000,
  },
  {
    id: "no_drain",
    name: "Zero Gas",
    type: "control",
    priority: 5,
    knock: 4,
    energyCost: 1,
    effect: "Disrupts the opponent without burning out your stamina.",
    color: "#4ade80",
    bgColor: "#052e16",
    image: C,
    isPremium: true,
    price: 130000,
  },
  {
    id: "bite",
    name: "Bite",
    type: "strike",
    priority: 6,
    knock: 3,
    energyCost: 1,
    effect: "A vicious, desperate attack that sneaks past guards.",
    color: "#f59e0b",
    bgColor: "#451a03",
    image: S,
    isPremium: true,
    price: 110000,
  },
  {
    id: "cage",
    name: "Sequencer Cage",
    type: "control",
    priority: 5,
    knock: 5,
    energyCost: 3,
    effect: "Trap the opponent in a tight box and force a losing exchange.",
    color: "#f43f5e",
    bgColor: "#4c0519",
    image: C,
    isPremium: true,
    price: 144000,
  },
  {
    id: "ethereal_form",
    name: "Ethereal Form",
    type: "defense",
    priority: 7,
    knock: 3,
    energyCost: 2,
    effect: "Phase out of danger and negate most incoming pressure this slot.",
    color: "#a78bfa",
    bgColor: "#2e1065",
    image: D,
    isPremium: true,
    price: 156000,
  },
  {
    id: "fire",
    name: "Basefire",
    type: "strike",
    priority: 4,
    knock: 9,
    energyCost: 4,
    effect: "A scorching burst that burns through weak setups.",
    color: "#f97316",
    bgColor: "#431407",
    image: S,
    isPremium: true,
    price: 186000,
  },
  {
    id: "grab",
    name: "Grab",
    type: "control",
    priority: 6,
    knock: 4,
    energyCost: 2,
    effect: "Interrupt the opponent's rhythm and drag them into your tempo.",
    color: "#22d3ee",
    bgColor: "#083344",
    image: C,
    isPremium: true,
    price: 126000,
  },
  {
    id: "gravity_well",
    name: "Gravity Well",
    type: "control",
    priority: 3,
    knock: 7,
    energyCost: 3,
    effect: "Collapse the arena around your target, crushing escape routes.",
    color: "#7c3aed",
    bgColor: "#3b0764",
    image: C,
    isPremium: true,
    price: 168000,
  },
  {
    id: "halo_knee_jab",
    name: "Halo Knee Jab",
    type: "strike",
    priority: 7,
    knock: 7,
    energyCost: 3,
    effect: "Explosive knee-first engage with elite opening speed.",
    color: "#f59e0b",
    bgColor: "#451a03",
    image: S,
    isPremium: true,
    price: 177000,
  },
  {
    id: "halo_shield",
    name: "Halo Shield",
    type: "defense",
    priority: 6,
    knock: 3,
    energyCost: 1,
    effect: "A radiant shield that absorbs impact and steadies your stance.",
    color: "#38bdf8",
    bgColor: "#0c2340",
    image: D,
    isPremium: true,
    price: 108000,
  },
  {
    id: "jaw_breaker",
    name: "Jaw Breaker",
    type: "strike",
    priority: 4,
    knock: 10,
    energyCost: 4,
    effect: "Heavy close-range smash designed to end rounds instantly.",
    color: "#ef4444",
    bgColor: "#450a0a",
    image: S,
    isPremium: true,
    price: 210000,
  },
  {
    id: "lightning",
    name: "Lightning",
    type: "strike",
    priority: 8,
    knock: 7,
    energyCost: 4,
    effect: "Near-instant electric strike that hits before most counters activate.",
    color: "#fde047",
    bgColor: "#422006",
    image: S,
    isPremium: true,
    price: 204000,
  },
  {
    id: "shadow_bind",
    name: "Shadow Bind",
    type: "control",
    priority: 7,
    knock: 6,
    energyCost: 3,
    effect: "Lock the opponent's movement and force a bad follow-up.",
    color: "#8b5cf6",
    bgColor: "#2e1065",
    image: C,
    isPremium: true,
    price: 162000,
  },
  {
    id: "downslide",
    name: "Downslide",
    type: "defense",
    priority: 6,
    knock: 3,
    energyCost: 2,
    effect: "Low evasive slide that avoids high pressure and resets spacing.",
    color: "#10b981",
    bgColor: "#052e16",
    image: D,
    isPremium: true,
    price: 117000,
  },
];

export function buildDeck(unlockedCards: string[] = []): Card[] {
  const available = CARDS.filter((c) => !c.isPremium || unlockedCards.includes(c.id));
  return [...available].sort(() => Math.random() - 0.5).slice(0, 10);
}

// ── Base ecosystem facts — the FACTS token reward pool ─────────────────────
export const BASE_FACTS: string[] = [
  "Base is an Ethereum L2 incubated by Coinbase, built on the OP Stack.",
  "Base mainnet launched to the public in August 2023 with the Onchain Summer campaign.",
  "Base uses ETH for gas — no separate gas token required.",
  "Basenames give onchain identity to Base wallets, like alice.base.eth.",
  "Farcaster Mini Apps run inside social feeds — no install, instant play.",
  "USDC on Base is native, issued by Circle, not a bridged wrapper.",
  "Aerodrome is one of Base's largest DEX and liquidity hubs.",
  "The OP Stack lets Base share upgrades with the wider Superchain.",
  "Base blocks target 2 seconds, keeping onchain games responsive.",
  "Smart Wallet brings passkey sign-in to Base — no seed phrase required.",
  "Zora on Base made minting media onchain cheap enough to be casual.",
  "Coinbase Onchain Kit gives builders drop-in React components for Base.",
  "Base Paymaster can sponsor gas so users play without holding ETH.",
  "Farcaster frames turned social posts into interactive onchain surfaces.",
  "Base App and Warpcast surface Mini Apps directly to millions of users.",
  "Base's builder grants have funded thousands of onchain experiments.",
  "Uniswap, Morpho and Moonwell all run major deployments on Base.",
  "ERC-4337 account abstraction makes onchain gaming sessions gasless.",
  "Base NFTs settle to Ethereum L1, inheriting its security guarantees.",
  "Onchain AI agents on Base can hold wallets and pay for their own compute.",
];

export function randomFact(): string {
  return BASE_FACTS[Math.floor(Math.random() * BASE_FACTS.length)]!;
}
