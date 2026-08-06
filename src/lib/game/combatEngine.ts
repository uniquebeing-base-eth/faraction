// @ts-nocheck
/* Ported combat logic — preserved from the original Action Order engine. */
import { Card, CardType, Character, CARDS } from "./gameData";

const CARD_TYPES: CardType[] = ["strike", "defense", "control"];

// ── Combat character stats ─────────────────────────────────────────────────

export interface CombatChar {
  knockMult: number; // multiplier applied to all knock dealt
  priorityBonus: number; // fractional bonus that breaks priority ties
  charId?: string; // character id for passive effects
}

export interface SlotContext {
  player: CombatChar;
  opponent: CombatChar;
  playerKnockDebuff: number; // flat reduction to player's knock this slot
  opponentKnockDebuff: number; // flat reduction to opponent's knock this slot
  playerTotalKnock: number; // running total before this slot (for Finisher)
  opponentTotalKnock: number; // running total before this slot
  slotIndex?: number; // 0-based slot position (for Riven passive)
  playerComboStreak?: number; // consecutive slots won by player going into this slot
  opponentComboStreak?: number;
  playerLastStand?: boolean; // player is down 0-2 in rounds — +20% knock
  opponentLastStand?: boolean;
  playerUltimateEffect?: NonNullable<Character["ultimate"]>["effect"];
  opponentUltimateEffect?: NonNullable<Character["ultimate"]>["effect"];
  playerAttunementPriorityBoost?: number;
  opponentAttunementPriorityBoost?: number;
}

export function charToCombat(c: Character): CombatChar {
  return {
    knockMult: c.knockStat / 75, // 75 = baseline 1.0×
    priorityBonus: c.priorityStat,
    charId: c.id,
  };
}

export function calcEnergyPool(c: Character): number {
  // Minimum 10 so every character can build a valid 5-card deck
  return Math.max(10, Math.round(7 + (c.drainStat / 100) * 6));
}

const DEFAULT_CHAR: CombatChar = { knockMult: 1, priorityBonus: 0 };

const DEFAULT_CTX: SlotContext = {
  player: DEFAULT_CHAR,
  opponent: DEFAULT_CHAR,
  playerKnockDebuff: 0,
  opponentKnockDebuff: 0,
  playerTotalKnock: 0,
  opponentTotalKnock: 0,
};

// ── Type advantage matrix ──────────────────────────────────────────────────

export function getTypeAdvantage(a: CardType, b: CardType): "win" | "lose" | "draw" {
  if (a === b) return "draw";
  if (
    (a === "strike" && b === "control") ||
    (a === "control" && b === "defense") ||
    (a === "defense" && b === "strike")
  )
    return "win";
  return "lose";
}

// ── Slot resolution ────────────────────────────────────────────────────────

export interface SlotResult {
  playerCard: Card;
  opponentCard: Card;
  winner: "player" | "opponent" | "draw";
  playerKnock: number; // knock dealt TO opponent
  opponentKnock: number; // knock dealt TO player
  typeAdvantage: "win" | "lose" | "draw";
  priorityWinner: "player" | "opponent" | "tie";
  description: string;
  effect?: string;
  nextOpponentKnockDebuff?: number;
  nextPlayerKnockDebuff?: number;
  isCrit?: boolean; // player landed a crit
  isOpponentCrit?: boolean; // opponent landed a crit
  playerComboBonus?: number; // bonus knock player received from combo
  opponentComboBonus?: number;
  playerComboStreak?: number; // streak after this slot resolves
  opponentComboStreak?: number;
  playerAttunementBoosted?: boolean;
  opponentAttunementBoosted?: boolean;
  playerEffectivePriority?: number;
  opponentEffectivePriority?: number;
}

export function resolveSlot(
  playerCard: Card,
  opponentCard: Card,
  ctx: Partial<SlotContext> = {},
): SlotResult {
  const c: SlotContext = { ...DEFAULT_CTX, ...ctx };

  // ── Wild card: randomise type at resolve time ─────────────────────────
  if (playerCard.isWild) {
    const randType = CARD_TYPES[Math.floor(Math.random() * 3)];
    playerCard = { ...playerCard, type: randType };
  }
  if (opponentCard.isWild) {
    const randType = CARD_TYPES[Math.floor(Math.random() * 3)];
    opponentCard = { ...opponentCard, type: randType };
  }

  // ── Evasion: avoid all damage ────────────────────────────────────────
  if (playerCard.id === "evasion") {
    return {
      playerCard,
      opponentCard,
      winner: "draw",
      playerKnock: 0,
      opponentKnock: 0,
      typeAdvantage: "draw",
      priorityWinner: "tie",
      description: `${playerCard.name} phases out — no damage exchanged.`,
      effect: "evasion",
    };
  }
  if (opponentCard.id === "evasion") {
    return {
      playerCard,
      opponentCard,
      winner: "draw",
      playerKnock: 0,
      opponentKnock: 0,
      typeAdvantage: "draw",
      priorityWinner: "tie",
      description: `Opponent uses ${opponentCard.name} — no damage exchanged.`,
      effect: "evasion",
    };
  }

  // ── Reversal Edge vs Strike: reflect force ───────────────────────────
  if (playerCard.id === "reversal_edge" && opponentCard.type === "strike") {
    const reflected = Math.round(opponentCard.knock * c.opponent.knockMult);
    return {
      playerCard,
      opponentCard,
      winner: "player",
      playerKnock: reflected,
      opponentKnock: 0,
      typeAdvantage: "win",
      priorityWinner: "player",
      description: `${playerCard.name} reflects ${opponentCard.name}'s force back!`,
      effect: "reversal",
    };
  }
  if (opponentCard.id === "reversal_edge" && playerCard.type === "strike") {
    const reflected = Math.round(playerCard.knock * c.player.knockMult);
    return {
      playerCard,
      opponentCard,
      winner: "opponent",
      playerKnock: 0,
      opponentKnock: reflected,
      typeAdvantage: "lose",
      priorityWinner: "opponent",
      description: `Opponent's ${opponentCard.name} reflects your ${playerCard.name}!`,
      effect: "reversal",
    };
  }

  // ── Mind Game flags (cancels opponent defense effects) ───────────────
  const playerMindGame = playerCard.id === "mind_game";
  const opponentMindGame = opponentCard.id === "mind_game";

  // ── Type advantage (Phantom Break pierces defense) ───────────────────
  let typeAdv = getTypeAdvantage(playerCard.type, opponentCard.type);
  if (playerCard.id === "phantom_break" && opponentCard.type === "defense") typeAdv = "win";
  if (opponentCard.id === "phantom_break" && playerCard.type === "defense") typeAdv = "lose";

  // ── Priority comparison (priorityStat breaks ties) ───────────────────
  // Elara's "priority_surge" ultimate grants first-strike through the same
  // priority path as attunement boosts, matching its "+5 priority" text (M-05).
  const playerPriorityBoost =
    (c.playerAttunementPriorityBoost ?? 0) + (c.playerUltimateEffect === "priority_surge" ? 5 : 0);
  const opponentPriorityBoost =
    (c.opponentAttunementPriorityBoost ?? 0) +
    (c.opponentUltimateEffect === "priority_surge" ? 5 : 0);
  const playerEffectivePriority = playerCard.priority + playerPriorityBoost;
  const opponentEffectivePriority = opponentCard.priority + opponentPriorityBoost;
  const pPriority = playerEffectivePriority + c.player.priorityBonus * 0.01;
  const oPriority = opponentEffectivePriority + c.opponent.priorityBonus * 0.01;
  const priorityWinner: "player" | "opponent" | "tie" =
    pPriority > oPriority ? "player" : oPriority > pPriority ? "opponent" : "tie";

  let playerKnockBase = 0;
  let opponentKnockBase = 0;
  let winner: "player" | "opponent" | "draw" = "draw";
  let description = "";

  if (typeAdv === "win") {
    playerKnockBase = playerCard.knock;
    opponentKnockBase = Math.max(0, Math.floor(opponentCard.knock * 0.3));
    winner = "player";
    description = `${playerCard.name} overcomes ${opponentCard.name}! ${playerCard.type.toUpperCase()} beats ${opponentCard.type.toUpperCase()}`;
  } else if (typeAdv === "lose") {
    opponentKnockBase = opponentCard.knock;
    playerKnockBase = Math.max(0, Math.floor(playerCard.knock * 0.3));
    winner = "opponent";
    description = `${opponentCard.name} overcomes ${playerCard.name}! ${opponentCard.type.toUpperCase()} beats ${playerCard.type.toUpperCase()}`;
  } else {
    if (priorityWinner === "player") {
      playerKnockBase = playerCard.knock;
      opponentKnockBase = Math.floor(opponentCard.knock * 0.5);
      winner = "player";
      description = `Both play ${playerCard.type.toUpperCase()} — ${playerCard.name} strikes first!`;
    } else if (priorityWinner === "opponent") {
      opponentKnockBase = opponentCard.knock;
      playerKnockBase = Math.floor(playerCard.knock * 0.5);
      winner = "opponent";
      description = `Both play ${playerCard.type.toUpperCase()} — ${opponentCard.name} strikes first!`;
    } else {
      playerKnockBase = Math.floor(playerCard.knock * 0.5);
      opponentKnockBase = Math.floor(opponentCard.knock * 0.5);
      winner = "draw";
      description = `${playerCard.name} clashes with ${opponentCard.name} — a perfect stalemate!`;
    }
  }

  // ── Disrupt: zero out if opponent isn't striking ─────────────────────
  if (playerCard.id === "disrupt" && opponentCard.type !== "strike") {
    playerKnockBase = 0;
    description = `${playerCard.name} finds no opening — opponent isn't striking.`;
  }
  if (opponentCard.id === "disrupt" && playerCard.type !== "strike") {
    opponentKnockBase = 0;
  }

  // ── Guard Stance: blocks attacks with priority ≤ 2 ───────────────────
  if (playerCard.id === "guard_stance" && opponentEffectivePriority <= 2 && !opponentMindGame) {
    opponentKnockBase = 0;
    description = `${playerCard.name} shuts down the slow ${opponentCard.name}!`;
  }
  if (opponentCard.id === "guard_stance" && playerEffectivePriority <= 2 && !playerMindGame) {
    playerKnockBase = 0;
  }

  // ── Stability: reduces incoming strike knock by 40% ───────────────────
  if (playerCard.id === "stability" && opponentCard.type === "strike" && !opponentMindGame) {
    opponentKnockBase = Math.round(opponentKnockBase * 0.6);
  }
  if (opponentCard.id === "stability" && playerCard.type === "strike" && !playerMindGame) {
    playerKnockBase = Math.round(playerKnockBase * 0.6);
  }

  // ── Anticipation: halves all incoming knock ───────────────────────────
  if (playerCard.id === "anticipation" && !opponentMindGame) {
    opponentKnockBase = Math.round(opponentKnockBase * 0.5);
  }
  if (opponentCard.id === "anticipation" && !playerMindGame) {
    playerKnockBase = Math.round(playerKnockBase * 0.5);
  }

  // ── Apply character knock multiplier ─────────────────────────────────
  let playerKnock = Math.round(playerKnockBase * c.player.knockMult);
  let opponentKnock = Math.round(opponentKnockBase * c.opponent.knockMult);

  // ── Apply slot debuffs from previous Pressure Advance ────────────────
  playerKnock = Math.max(0, playerKnock - c.playerKnockDebuff);
  opponentKnock = Math.max(0, opponentKnock - c.opponentKnockDebuff);

  // ── Direct Impact: floor at 50% of base even on loss ─────────────────
  if (playerCard.id === "direct_impact") {
    const floor = Math.round(playerCard.knock * c.player.knockMult * 0.5);
    playerKnock = Math.max(playerKnock, floor);
  }
  if (opponentCard.id === "direct_impact") {
    const floor = Math.round(opponentCard.knock * c.opponent.knockMult * 0.5);
    opponentKnock = Math.max(opponentKnock, floor);
  }

  // ── Finisher: +4 bonus when currently losing ─────────────────────────
  if (playerCard.id === "finisher" && c.playerTotalKnock < c.opponentTotalKnock) {
    playerKnock += 4;
    description += " [FINISHER ACTIVATED!]";
  }
  if (opponentCard.id === "finisher" && c.opponentTotalKnock < c.playerTotalKnock) {
    opponentKnock += 4;
  }

  // ── Power Punch: +3 bonus on type-advantage win ───────────────────────
  if (playerCard.id === "power_punch" && typeAdv === "win") {
    playerKnock += 3;
  }
  if (opponentCard.id === "power_punch" && typeAdv === "lose") {
    opponentKnock += 3;
  }

  // ── Character passives ────────────────────────────────────────────────
  // Kaira "First Strike": +2 knock on the opening slot (index 0)
  if (c.player.charId === "kaira" && c.slotIndex === 0 && winner === "player") playerKnock += 2;
  if (c.opponent.charId === "kaira" && c.slotIndex === 0 && winner === "opponent")
    opponentKnock += 2;
  // Kenji "Blade Speed": +2 knock when winning a same-type priority clash
  if (c.player.charId === "kenji" && typeAdv === "draw" && priorityWinner === "player")
    playerKnock += 2;
  if (c.opponent.charId === "kenji" && typeAdv === "draw" && priorityWinner === "opponent")
    opponentKnock += 2;
  // Riven "Phantom Dodge": halve damage received on slot 3 (index 2)
  if (c.player.charId === "riven" && c.slotIndex === 2)
    opponentKnock = Math.floor(opponentKnock * 0.5);
  if (c.opponent.charId === "riven" && c.slotIndex === 2)
    playerKnock = Math.floor(playerKnock * 0.5);
  // Zane "Bulldoze": +2 knock on every strike type-win
  if (c.player.charId === "zane" && playerCard.type === "strike" && typeAdv === "win")
    playerKnock += 2;
  if (c.opponent.charId === "zane" && opponentCard.type === "strike" && typeAdv === "lose")
    opponentKnock += 2;
  // Cinder "Molten Core": +3 knock on any slot where no damage is taken
  if (c.player.charId === "cinder" && opponentKnock === 0) playerKnock += 3;
  if (c.opponent.charId === "cinder" && playerKnock === 0) opponentKnock += 3;
  // Noxar "Sixfold Sight": +2 knock while on a 2+ win streak
  if (c.player.charId === "noxar" && (c.playerComboStreak ?? 0) >= 2 && winner === "player")
    playerKnock += 2;
  if (c.opponent.charId === "noxar" && (c.opponentComboStreak ?? 0) >= 2 && winner === "opponent")
    opponentKnock += 2;
  // Azel "Wandering Guard": halve damage received on slot 2 (index 1)
  if (c.player.charId === "azel" && c.slotIndex === 1)
    opponentKnock = Math.floor(opponentKnock * 0.5);
  if (c.opponent.charId === "azel" && c.slotIndex === 1)
    playerKnock = Math.floor(playerKnock * 0.5);
  // Pip "Slippery": halve damage received on the opening slot
  if (c.player.charId === "pip" && c.slotIndex === 0)
    opponentKnock = Math.floor(opponentKnock * 0.5);
  if (c.opponent.charId === "pip" && c.slotIndex === 0)
    playerKnock = Math.floor(playerKnock * 0.5);


  // ── Critical hits (based on priority stat) ────────────────────────────────
  // Crit chance = 8% + priorityStat * 0.07% (max ~15% at priorityStat=100)
  const playerCritChance = 0.08 + c.player.priorityBonus * 0.0007;
  const opponentCritChance = 0.08 + c.opponent.priorityBonus * 0.0007;
  const isCrit = winner === "player" && Math.random() < playerCritChance;
  const isOpponentCrit = winner === "opponent" && Math.random() < opponentCritChance;
  if (isCrit) {
    playerKnock = Math.round(playerKnock * 2);
    description += " [CRITICAL!]";
  }
  if (isOpponentCrit) {
    opponentKnock = Math.round(opponentKnock * 2);
  }

  // ── Combo streak bonus: 3+ consecutive wins → +3 knock ───────────────
  const playerStreak = c.playerComboStreak ?? 0;
  const opponentStreak = c.opponentComboStreak ?? 0;
  let playerComboBonus = 0;
  let opponentComboBonus = 0;
  if (playerStreak >= 3 && winner === "player") {
    playerComboBonus = 3;
    playerKnock += playerComboBonus;
    description += " [COMBO!]";
  }
  if (opponentStreak >= 3 && winner === "opponent") {
    opponentComboBonus = 3;
    opponentKnock += opponentComboBonus;
  }

  // ── Last Stand: +20% knock when losing the round ─────────────────────
  if (c.playerLastStand) playerKnock = Math.round(playerKnock * 1.2);
  if (c.opponentLastStand) opponentKnock = Math.round(opponentKnock * 1.2);

  // ── Recalculate winner after all modifiers ────────────────────────────
  if (playerKnock > opponentKnock) winner = "player";
  else if (opponentKnock > playerKnock) winner = "opponent";
  else winner = "draw";

  // ── Pressure Advance: debuff opponent's next slot by -2 ──────────────
  let nextOpponentKnockDebuff = playerCard.id === "pressure_advance" ? 2 : 0;
  let nextPlayerKnockDebuff = opponentCard.id === "pressure_advance" ? 2 : 0;
  // Elara "Void Drain": +1 debuff after any control win
  if (c.player.charId === "elara" && playerCard.type === "control" && winner === "player")
    nextOpponentKnockDebuff += 1;
  if (c.opponent.charId === "elara" && opponentCard.type === "control" && winner === "opponent")
    nextPlayerKnockDebuff += 1;
  // Goblyn "Rune Leech": -1 on the opponent's next slot after any control exchange
  if (c.player.charId === "goblyn" && playerCard.type === "control") nextOpponentKnockDebuff += 1;
  if (c.opponent.charId === "goblyn" && opponentCard.type === "control")
    nextPlayerKnockDebuff += 1;

  // ── Ultimate effects ──────────────────────────────────────────────────
  if (c.playerUltimateEffect) {
    switch (c.playerUltimateEffect) {
      case "guaranteed_crit":
        // Cap at 2×: don't stack on top of a random crit (M-05).
        if (!isCrit) playerKnock = Math.round(playerKnock * 2);
        description += " [ULTIMATE: BLINDING FLASH!]";
        break;
      case "double_knock":
        playerKnock = Math.round(playerKnock * 2);
        description += " [ULTIMATE: BLADE STORM!]";
        break;
      case "full_dodge":
        opponentKnock = 0;
        description += " [ULTIMATE: PHASE SHIFT!]";
        break;
      case "drain_debuff":
        nextOpponentKnockDebuff += 3;
        description += " [ULTIMATE: SEISMIC SLAM!]";
        break;
      case "priority_surge":
        // Applied as a +5 priority (first-strike) boost above, not bonus knock (M-05).
        description += " [ULTIMATE: VOID SURGE!]";
        break;
    }
  }
  if (c.opponentUltimateEffect) {
    switch (c.opponentUltimateEffect) {
      case "guaranteed_crit":
        // Cap at 2×: don't stack on top of a random crit (M-05).
        if (!isOpponentCrit) opponentKnock = Math.round(opponentKnock * 2);
        break;
      case "double_knock":
        opponentKnock = Math.round(opponentKnock * 2);
        break;
      case "full_dodge":
        playerKnock = 0;
        break;
      case "drain_debuff":
        nextPlayerKnockDebuff += 3;
        break;
      case "priority_surge":
        // Applied as a +5 priority (first-strike) boost above, not bonus knock (M-05).
        break;
    }
  }
  // Recalculate winner again after ultimates
  if (playerKnock > opponentKnock) winner = "player";
  else if (opponentKnock > playerKnock) winner = "opponent";
  else winner = "draw";

  if (playerPriorityBoost > 0) {
    description += " [ATTUNED SURGE!]";
  }

  const effect =
    playerCard.id === "pressure_advance" || opponentCard.id === "pressure_advance"
      ? "pressure"
      : playerCard.id === "mind_game" || opponentCard.id === "mind_game"
        ? "mindgame"
        : undefined;

  return {
    playerCard,
    opponentCard,
    winner,
    playerKnock,
    opponentKnock,
    typeAdvantage: typeAdv,
    priorityWinner,
    description,
    effect,
    nextOpponentKnockDebuff: nextOpponentKnockDebuff || undefined,
    nextPlayerKnockDebuff: nextPlayerKnockDebuff || undefined,
    isCrit: isCrit || undefined,
    isOpponentCrit: isOpponentCrit || undefined,
    playerComboBonus: playerComboBonus || undefined,
    opponentComboBonus: opponentComboBonus || undefined,
    playerAttunementBoosted: playerPriorityBoost > 0 || undefined,
    opponentAttunementBoosted: opponentPriorityBoost > 0 || undefined,
    playerEffectivePriority,
    opponentEffectivePriority,
  };
}

// ── AI order generation ────────────────────────────────────────────────────

// What type beats a given type
const COUNTER_TYPE: Record<CardType, CardType> = {
  strike: "defense", // defense beats strike
  control: "strike", // strike beats control
  defense: "control", // control beats defense
};

export interface AIRoundContext {
  playerRoundsWon: number;
  opponentRoundsWon: number;
  playerOrder?: Card[]; // player's visible card selection for this round
  previousAiOrderIds?: string[];
  roundNumber?: number;
}

type AIDifficulty = 0 | 1 | 2 | 3;

function shuffleCards(cards: Card[]): Card[] {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function arrangeHardDifficultyOrder(cards: Card[], previousAiOrderIds: string[]): Card[] {
  if (cards.length <= 1) return cards;

  const remaining = [...cards];
  const arranged: Card[] = [];

  for (let i = 0; i < cards.length; i++) {
    const previousId = previousAiOrderIds[i];
    const eligibleIndices = remaining
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.id !== previousId)
      .map(({ index }) => index);

    const pool = eligibleIndices.length > 0 ? eligibleIndices : remaining.map((_, index) => index);
    const choiceWindow = Math.min(2, pool.length);
    const chosenPoolIndex = Math.floor(Math.random() * choiceWindow);
    const chosenIndex = pool[chosenPoolIndex];
    arranged.push(remaining.splice(chosenIndex, 1)[0]);
  }

  return arranged;
}

function arrangeNormalDifficultyOrder(cards: Card[], previousAiOrderIds: string[]): Card[] {
  if (cards.length <= 1) return cards;

  const remaining = shuffleCards(cards);
  const arranged: Card[] = [];

  for (let i = 0; i < cards.length; i++) {
    const previousId = previousAiOrderIds[i];
    const eligible = previousId ? remaining.filter((card) => card.id !== previousId) : remaining;
    const pool = eligible.length > 0 ? eligible : remaining;
    const choiceWindow = Math.min(3, pool.length);
    const chosen = pool[Math.floor(Math.random() * choiceWindow)];
    const chosenIndex = remaining.findIndex((card) => card.id === chosen.id);
    arranged.push(remaining.splice(chosenIndex, 1)[0]);
  }

  return arranged;
}

function countOrderWins(slots: SlotResult[]): number {
  return slots.reduce((total, slot) => total + (slot.winner === "opponent" ? 1 : 0), 0);
}

function buildBossOrders(
  scoredCards: Card[],
  energyPool: number,
  previousAiOrderIds: string[],
  typeLimit: number,
): Card[][] {
  const source = scoredCards.slice(0, 8);
  const results: Card[][] = [];

  const walk = (
    picks: Card[],
    usedEnergy: number,
    startIndex: number,
    typeCount: Record<CardType, number>,
  ) => {
    if (results.length >= 28) return;
    if (picks.length === 5) {
      results.push([...picks]);
      return;
    }

    for (let i = startIndex; i < source.length; i++) {
      const card = source[i];
      if (usedEnergy + card.energyCost > energyPool) continue;
      if (typeCount[card.type] >= typeLimit) continue;
      picks.push(card);
      typeCount[card.type]++;
      walk(picks, usedEnergy + card.energyCost, i + 1, typeCount);
      typeCount[card.type]--;
      picks.pop();
    }
  };

  walk([], 0, 0, { strike: 0, defense: 0, control: 0 });

  if (results.length === 0) {
    results.push(scoredCards.slice(0, 5));
  }

  const permutationsFor = (cards: Card[]): Card[][] => {
    const out: Card[][] = [];
    const used = Array(cards.length).fill(false);
    const current: Card[] = [];
    const recurse = () => {
      if (out.length >= 14) return;
      if (current.length === cards.length) {
        out.push([...current]);
        return;
      }
      for (let i = 0; i < cards.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        current.push(cards[i]);
        recurse();
        current.pop();
        used[i] = false;
      }
    };
    recurse();
    return out;
  };

  const allOrders: Card[][] = [];
  for (const combo of results.slice(0, 6)) {
    allOrders.push(...permutationsFor(combo));
  }

  const deduped = new Map<string, Card[]>();
  for (const order of allOrders) {
    const key = order.map((card) => card.id).join("|");
    if (!deduped.has(key)) deduped.set(key, order);
  }

  const previousKey = previousAiOrderIds.join("|");
  return Array.from(deduped.values()).filter(
    (order) => order.map((card) => card.id).join("|") !== previousKey,
  );
}

function scoreBossOrder(
  order: Card[],
  aiChar: Character | undefined,
  playerChar: Character | undefined,
  roundCtx: AIRoundContext,
): number {
  if (!roundCtx.playerOrder || roundCtx.playerOrder.length !== 5) {
    return order.reduce((score, card, index) => {
      const antiRepeat = roundCtx.previousAiOrderIds?.[index] === card.id ? -1.2 : 0;
      return score + card.knock * 1.15 + card.priority * 0.9 + antiRepeat;
    }, 0);
  }

  const resolution = resolveRound(roundCtx.playerOrder, order, playerChar, aiChar, {
    playerLastStand: roundCtx.playerRoundsWon === 0 && roundCtx.opponentRoundsWon >= 1,
    opponentLastStand: roundCtx.opponentRoundsWon === 0 && roundCtx.playerRoundsWon >= 1,
  });
  const repeatedSlots = order.reduce(
    (count, card, index) => count + (roundCtx.previousAiOrderIds?.[index] === card.id ? 1 : 0),
    0,
  );
  const cardValue = order.reduce((sum, card) => sum + card.priority * 0.55 + card.knock * 0.4, 0);
  const slotWins = countOrderWins(resolution.slots);
  const roundScore =
    (resolution.roundWinner === "opponent" ? 120 : resolution.roundWinner === "draw" ? 28 : -48) +
    slotWins * 16 +
    (resolution.totalOpponentKnock - resolution.totalPlayerKnock) * 2.4 +
    cardValue -
    repeatedSlots * 4;

  return roundScore;
}

// difficulty: 0=easy (random), 1=normal (adaptive), 2=hard (optimal + counters), 3=boss
export function generateAIOrder(
  aiChar?: Character,
  playerChar?: Character,
  difficulty: AIDifficulty = 1,
  roundCtx?: AIRoundContext,
): Card[] {
  const energyPool = aiChar ? calcEnergyPool(aiChar) : 10;

  // Easy mode: random selection with no strategy
  if (difficulty === 0) {
    const valid = CARDS.filter((c) => !c.isWild && c.energyCost <= energyPool);
    const shuffled = shuffleCards(valid);
    const picks: Card[] = [];
    let usedEnergy = 0;
    for (const card of shuffled) {
      if (picks.length >= 5) break;
      if (usedEnergy + card.energyCost > energyPool) continue;
      picks.push(card);
      usedEnergy += card.energyCost;
    }
    return shuffleCards(picks);
  }

  // ── Analyse player's deck to find counter type ─────────────────────────
  // Count player's type distribution from their visible order
  const playerTypeCounts: Record<CardType, number> = { strike: 0, defense: 0, control: 0 };
  if (roundCtx?.playerOrder) {
    for (const c of roundCtx.playerOrder) {
      if (c.type === "strike" || c.type === "defense" || c.type === "control")
        playerTypeCounts[c.type]++;
    }
  } else if (playerChar) {
    // No visible order yet — guess from character bias (higher priority → more strike/control)
    const bias =
      playerChar.priorityStat > 5 ? "control" : playerChar.knockStat > 75 ? "strike" : "defense";
    playerTypeCounts[bias] = 3;
  }

  // Dominant player type → what the AI should counter with
  const dominantPlayerType = (Object.entries(playerTypeCounts) as [CardType, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0][0];
  const counterType: CardType = COUNTER_TYPE[dominantPlayerType];

  // ── Round state aggression ─────────────────────────────────────────────
  // If AI is losing rounds, go aggressive (more knock). If winning, play safe.
  const aiRoundsWon = roundCtx?.opponentRoundsWon ?? 0;
  const playerRoundsWon = roundCtx?.playerRoundsWon ?? 0;
  const isLosing = aiRoundsWon < playerRoundsWon;
  const isWinning = aiRoundsWon > playerRoundsWon;
  const previousAiOrderIds = roundCtx?.previousAiOrderIds ?? [];
  const previousAiOrderSet = new Set(previousAiOrderIds);

  // Score each card
  const scored = CARDS.filter((c) => !c.isWild).map((c) => {
    let score = c.knock + c.priority * 0.5;

    // Base strategic bonuses
    if (c.id === "reversal_edge") score += 3;
    if (c.id === "anticipation") score += 2;
    if (c.id === "disrupt") score += 2;
    if (c.id === "evasion") score += 1;
    score += c.energyCost === 0 ? 2 : c.knock / (c.energyCost + 0.5);

    // Counter-type bonus (normal: +2, hard: +4)
    if (c.type === counterType) score += difficulty >= 3 ? 5 : difficulty === 2 ? 4 : 2;

    // Mild anti-repeat bias so house rounds do not keep surfacing the same 5 cards.
    if (previousAiOrderSet.has(c.id)) score -= difficulty >= 3 ? 1.6 : difficulty === 2 ? 1.2 : 0.8;

    // Aggression adjustment
    if (isLosing) score += c.knock * 0.3; // prioritise damage when behind
    if (isWinning) score += c.priority * 0.4; // prioritise priority/safety when ahead

    // Hard mode: extra weight on high-priority and high-knock
    if (difficulty >= 2) score += c.priority * 0.3 + c.knock * 0.2;
    if (difficulty >= 3) {
      score += c.priority * 0.45 + c.knock * 0.3;
      if (c.type === "control") score += 0.8;
      if (c.id === "disrupt" || c.id === "anticipation" || c.id === "reversal_edge") score += 1.4;
    }

    // Normal mode: small random noise to feel human
    if (difficulty === 1) score += Math.random() * 1.5;

    return { card: c, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const picks: Card[] = [];
  let usedEnergy = 0;
  const typeCount: Record<string, number> = { strike: 0, defense: 0, control: 0 };
  // Hard mode allows stacking one type; normal enforces variety
  const typeLimit = difficulty >= 2 ? 3 : 2;

  for (const { card } of scored) {
    if (picks.length >= 5) break;
    if (usedEnergy + card.energyCost > energyPool) continue;
    if (typeCount[card.type] >= typeLimit) continue;
    picks.push(card);
    usedEnergy += card.energyCost;
    typeCount[card.type]++;
  }

  // Fill remaining slots ignoring type limit
  for (const { card } of scored) {
    if (picks.length >= 5) break;
    if (picks.some((p) => p.id === card.id)) continue;
    if (usedEnergy + card.energyCost > energyPool) continue;
    picks.push(card);
    usedEnergy += card.energyCost;
  }

  for (const { card } of scored) {
    if (picks.length >= 5) break;
    if (picks.some((p) => p.id === card.id)) continue;
    picks.push(card);
  }

  const exactRepeat =
    previousAiOrderIds.length === picks.length &&
    picks.every((card, index) => card.id === previousAiOrderIds[index]);

  if (difficulty >= 3) {
    const bossCandidates = buildBossOrders(
      scored.map(({ card }) => card),
      energyPool,
      previousAiOrderIds,
      3,
    );
    const scoredBoss = bossCandidates
      .map((order) => ({
        order,
        score: scoreBossOrder(
          order,
          aiChar,
          playerChar,
          roundCtx ?? {
            playerRoundsWon: 0,
            opponentRoundsWon: 0,
            previousAiOrderIds,
          },
        ),
      }))
      .sort((a, b) => b.score - a.score);
    const finalistPool = scoredBoss.slice(0, Math.min(3, scoredBoss.length));
    const weightedPick =
      finalistPool[Math.floor(Math.random() * finalistPool.length)] ?? scoredBoss[0];
    if (weightedPick?.order) return weightedPick.order;
  }

  // Hard keeps strategic order, but still rotates away from exact repeats.
  if (difficulty === 2) {
    const arranged =
      previousAiOrderIds.length > 0 ? arrangeHardDifficultyOrder(picks, previousAiOrderIds) : picks;
    if (!exactRepeat) return arranged;
    const shift = (roundCtx?.roundNumber ?? 1) % arranged.length || 1;
    return arranged.slice(shift).concat(arranged.slice(0, shift));
  }

  const shuffled = arrangeNormalDifficultyOrder(picks, previousAiOrderIds);
  if (!exactRepeat) return shuffled;
  const shift = (roundCtx?.roundNumber ?? 1) % shuffled.length || 1;
  return shuffled.slice(shift).concat(shuffled.slice(0, shift));
}

// ── Round resolution ───────────────────────────────────────────────────────

export interface RoundResult {
  slots: SlotResult[];
  totalPlayerKnock: number;
  totalOpponentKnock: number;
  roundWinner: "player" | "opponent" | "draw";
}

export interface RoundOptions {
  playerLastStand?: boolean;
  opponentLastStand?: boolean;
  playerUltimateEffect?: NonNullable<Character["ultimate"]>["effect"];
  opponentUltimateEffect?: NonNullable<Character["ultimate"]>["effect"];
  playerUltimateSlot?: number; // which slot the ultimate fires on (default: 0)
  opponentUltimateSlot?: number;
  playerAttunedCardIds?: string[];
  opponentAttunedCardIds?: string[];
  playerAttunementBoostAvailable?: boolean;
  opponentAttunementBoostAvailable?: boolean;
}

export function resolveRound(
  playerOrder: Card[],
  opponentOrder: Card[],
  playerChar?: Character,
  opponentChar?: Character,
  opts: RoundOptions = {},
): RoundResult {
  const playerCombat = playerChar ? charToCombat(playerChar) : DEFAULT_CHAR;
  const opponentCombat = opponentChar ? charToCombat(opponentChar) : DEFAULT_CHAR;

  const slots: SlotResult[] = [];
  let totalPlayerKnock = 0;
  let totalOpponentKnock = 0;
  let nextPlayerKnockDebuff = 0;
  let nextOpponentKnockDebuff = 0;
  let playerStreak = 0;
  let opponentStreak = 0;
  let playerAttunementBoostAvailable = opts.playerAttunementBoostAvailable ?? false;
  let opponentAttunementBoostAvailable = opts.opponentAttunementBoostAvailable ?? false;

  for (let i = 0; i < 5; i++) {
    const pUltSlot = opts.playerUltimateSlot ?? 0;
    const oUltSlot = opts.opponentUltimateSlot ?? 0;
    const playerCard = playerOrder[i];
    const opponentCard = opponentOrder[i];
    const playerAttunementPriorityBoost =
      playerAttunementBoostAvailable && !!opts.playerAttunedCardIds?.includes(playerCard.id)
        ? 1
        : 0;
    const opponentAttunementPriorityBoost =
      opponentAttunementBoostAvailable && !!opts.opponentAttunedCardIds?.includes(opponentCard.id)
        ? 1
        : 0;
    const result = resolveSlot(playerOrder[i], opponentOrder[i], {
      player: playerCombat,
      opponent: opponentCombat,
      playerKnockDebuff: nextPlayerKnockDebuff,
      opponentKnockDebuff: nextOpponentKnockDebuff,
      playerTotalKnock: totalPlayerKnock,
      opponentTotalKnock: totalOpponentKnock,
      slotIndex: i,
      playerComboStreak: playerStreak,
      opponentComboStreak: opponentStreak,
      playerLastStand: opts.playerLastStand,
      opponentLastStand: opts.opponentLastStand,
      playerUltimateEffect: i === pUltSlot ? opts.playerUltimateEffect : undefined,
      opponentUltimateEffect: i === oUltSlot ? opts.opponentUltimateEffect : undefined,
      playerAttunementPriorityBoost,
      opponentAttunementPriorityBoost,
    });
    slots.push(result);
    totalPlayerKnock += result.playerKnock;
    totalOpponentKnock += result.opponentKnock;
    nextPlayerKnockDebuff = result.nextPlayerKnockDebuff ?? 0;
    nextOpponentKnockDebuff = result.nextOpponentKnockDebuff ?? 0;
    if (result.playerAttunementBoosted) playerAttunementBoostAvailable = false;
    if (result.opponentAttunementBoosted) opponentAttunementBoostAvailable = false;
    if (result.winner === "player") {
      playerStreak++;
      opponentStreak = 0;
    } else if (result.winner === "opponent") {
      opponentStreak++;
      playerStreak = 0;
    } else {
      playerStreak = 0;
      opponentStreak = 0;
    }
  }

  const roundWinner: "player" | "opponent" | "draw" =
    totalPlayerKnock > totalOpponentKnock
      ? "player"
      : totalOpponentKnock > totalPlayerKnock
        ? "opponent"
        : "draw";

  return { slots, totalPlayerKnock, totalOpponentKnock, roundWinner };
}
