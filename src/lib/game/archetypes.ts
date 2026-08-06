// @ts-nocheck
/* Ported combat logic — preserved from the original Action Order engine. */
import { CARDS } from "./gameData";

export type ArchetypeKey = "aggro" | "control" | "tempo";

export type StarterArchetype = {
  key: ArchetypeKey;
  label: string;
  why: string;
  cardIds: string[];
};

export const CARD_INTEL: Record<string, { role: string; strongVs: string; weakVs: string }> = {
  phantom_break: { role: "Burst", strongVs: "slow defense", weakVs: "high priority control" },
  storm_kick: { role: "Tempo", strongVs: "heavy strike", weakVs: "hard counters" },
  power_punch: { role: "Finisher", strongVs: "low guard setups", weakVs: "anticipation" },
  direct_impact: { role: "Burst", strongVs: "hesitant control", weakVs: "reactive defense" },
  finisher: { role: "Finisher", strongVs: "drained opponents", weakVs: "early pressure" },
  guard_stance: { role: "Counter", strongVs: "quick strike chains", weakVs: "drain/control" },
  stability: { role: "Counter", strongVs: "raw power bursts", weakVs: "mix-up tempo" },
  reversal_edge: { role: "Counter", strongVs: "single big hit", weakVs: "chip pressure" },
  anticipation: { role: "Control", strongVs: "predictable openers", weakVs: "delay/mix-up" },
  mind_game: { role: "Control", strongVs: "defensive players", weakVs: "fast burst" },
  evasion: { role: "Tempo", strongVs: "high knock turns", weakVs: "multi-hit pressure" },
  pressure_advance: { role: "Tempo", strongVs: "passive setups", weakVs: "hard intercept" },
  disrupt: { role: "Counter", strongVs: "strike spam", weakVs: "defense stall" },
};

export function getStarterArchetypes(charId?: string): StarterArchetype[] {
  switch (charId) {
    case "kaira":
      return [
        {
          key: "aggro",
          label: "Aggro",
          why: "Fast openers plus a heavy closer to cash in Kaira's first-slot pressure.",
          cardIds: ["storm_kick", "direct_impact", "phantom_break", "javelin_dive", "power_punch"],
        },
        {
          key: "control",
          label: "Control",
          why: "Lets Kaira bait reactions, then convert with safe bursts after scouting tempo.",
          cardIds: ["mind_game", "evasion", "run_away", "disrupt", "inner_focus"],
        },
        {
          key: "tempo",
          label: "Tempo",
          why: "Cheap sequencing keeps initiative while leaving room to pivot into winning slots.",
          cardIds: ["storm_kick", "guard_stance", "anticipation", "mind_game", "pressure_advance"],
        },
      ];
    case "kenji":
      return [
        {
          key: "aggro",
          label: "Aggro",
          why: "Priority-skewed strikes give Kenji more chances to snowball winning clashes.",
          cardIds: [
            "storm_kick",
            "direct_impact",
            "phantom_break",
            "javelin_dive",
            "aerial_spear_fist",
          ],
        },
        {
          key: "control",
          label: "Control",
          why: "Reactive tools force respect, then Kenji steals rounds off high-priority punishes.",
          cardIds: ["mind_game", "evasion", "run_away", "guard_stance", "disrupt"],
        },
        {
          key: "tempo",
          label: "Tempo",
          why: "Balanced low-cost cards preserve initiative so Blade Speed stays active often.",
          cardIds: ["storm_kick", "anticipation", "guard_stance", "mind_game", "pressure_advance"],
        },
      ];
    case "riven":
      return [
        {
          key: "aggro",
          label: "Aggro",
          why: "Threatens sudden bursts while still letting Riven hide a swing turn in slot three.",
          cardIds: ["phantom_break", "storm_kick", "direct_impact", "javelin_dive", "power_punch"],
        },
        {
          key: "control",
          label: "Control",
          why: "Riven's evasive kit pairs best with reads, feints, and punish-focused counterplay.",
          cardIds: ["mind_game", "evasion", "run_away", "disrupt", "inner_focus"],
        },
        {
          key: "tempo",
          label: "Tempo",
          why: "Light-cost control keeps spacing fluid and rewards precise slot ordering.",
          cardIds: ["anticipation", "evasion", "guard_stance", "mind_game", "pressure_advance"],
        },
      ];
    case "zane":
      return [
        {
          key: "aggro",
          label: "Aggro",
          why: "High-knock strikes front-load damage so Zane can bully rounds before counters settle.",
          cardIds: ["power_punch", "storm_kick", "direct_impact", "javelin_dive", "phantom_break"],
        },
        {
          key: "control",
          label: "Control",
          why: "Just enough control to pin the opponent in place before Zane swings big.",
          cardIds: ["mind_game", "run_away", "disrupt", "guard_stance", "storm_kick"],
        },
        {
          key: "tempo",
          label: "Tempo",
          why: "Mixes safe setup cards with burst windows so Zane doesn't overcommit too early.",
          cardIds: ["storm_kick", "guard_stance", "anticipation", "mind_game", "pressure_advance"],
        },
      ];
    case "elara":
      return [
        {
          key: "aggro",
          label: "Aggro",
          why: "Elara can still rush, but this version uses cleaner burst windows instead of raw brawling.",
          cardIds: ["storm_kick", "direct_impact", "javelin_dive", "phantom_break", "power_punch"],
        },
        {
          key: "control",
          label: "Control",
          why: "This is Elara's signature lane: drain pressure, evasions, and tempo theft over time.",
          cardIds: ["mind_game", "evasion", "run_away", "inner_focus", "pressure_advance"],
        },
        {
          key: "tempo",
          label: "Tempo",
          why: "Priority pivots and cheap denial let Elara stay slippery until Void Surge takes over.",
          cardIds: ["anticipation", "guard_stance", "mind_game", "pressure_advance", "storm_kick"],
        },
      ];
    default:
      return [
        {
          key: "aggro",
          label: "Aggro",
          why: "Quick burst setup for players who want to pressure slots immediately.",
          cardIds: ["storm_kick", "direct_impact", "javelin_dive", "phantom_break", "power_punch"],
        },
        {
          key: "control",
          label: "Control",
          why: "Safer denial package that wins by reading and draining the opponent's plan.",
          cardIds: ["mind_game", "evasion", "run_away", "disrupt", "inner_focus"],
        },
        {
          key: "tempo",
          label: "Tempo",
          why: "Flexible low-cost cards that help you adapt slot by slot.",
          cardIds: ["storm_kick", "guard_stance", "anticipation", "mind_game", "pressure_advance"],
        },
      ];
  }
}

export function getPlayTips(charId?: string): string[] {
  switch (charId) {
    case "kaira":
      return [
        "Open aggressive on slot 1 to trigger First Strike.",
        "Save Ultimate for high-knock strike cards.",
      ];
    case "kenji":
      return [
        "Prioritize cards with high priority to snowball.",
        "Use Ultimate when you expect a slot win.",
      ];
    case "riven":
      return [
        "Anchor risky cards on slot 3 for passive value.",
        "Use Ultimate to nullify enemy power spikes.",
      ];
    case "zane":
      return [
        "Lean into strike-heavy sequences for bonus knock.",
        "Use Ultimate before opponent burst turns.",
      ];
    case "elara":
      return [
        "Mix control cards to sustain drain pressure.",
        "Ultimate works best when tempo is contested.",
      ];
    default:
      return [
        "Build a balanced sequence of strike, defense, and control.",
        "Keep 1 low-energy card for flexibility.",
      ];
  }
}

export function getArchetypePreview(charId?: string) {
  return getStarterArchetypes(charId).map((plan) => ({
    ...plan,
    cards: plan.cardIds
      .map((id) => CARDS.find((card) => card.id === id))
      .filter((card): card is NonNullable<typeof card> => !!card),
  }));
}
