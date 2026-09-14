import { PROD_ORIGIN } from "@/lib/config";
import { frameMeta } from "@/lib/frame-meta";

export type SharePreviewKind = "challenge" | "match" | "result" | "reward" | "leaderboard";

export interface SharePreviewContext {
  kind?: SharePreviewKind | undefined;
  matchId?: string | undefined;
  hostHandle?: string | undefined;
  opponentHandle?: string | undefined;
  winnerHandle?: string | undefined;
  loserHandle?: string | undefined;
  mode?: string | undefined;
  stake?: number | string | undefined;
  token?: string | undefined;
  reward?: number | string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  season?: string | undefined;
  won?: boolean | undefined;
  fighter?: string | undefined;
  oppFighter?: string | undefined;
}

function normalizeHandle(value?: string, fallback = "fighter") {
  const trimmed = (value ?? "").trim().replace(/^@/, "");
  return trimmed || fallback;
}

function formatReward(value?: number | string) {
  if (value === undefined || value === null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n >= 1000 ? `${n.toLocaleString()} FACTS` : `${n.toFixed(0)} FACTS`;
}

function kindLabel(kind?: SharePreviewKind) {
  switch (kind) {
    case "challenge":
      return "1v1 Battle";
    case "result":
      return "Battle complete";
    case "reward":
      return "Rewards unlocked";
    case "leaderboard":
      return "Season standings";
    case "match":
    default:
      return "FarAction match";
  }
}

export function shareImageUrl(context: SharePreviewContext = {}): string {
  const params = new URLSearchParams();
  if (context.kind) params.set("kind", context.kind);
  if (context.matchId) params.set("matchId", context.matchId);
  if (context.hostHandle) params.set("hostHandle", context.hostHandle);
  if (context.opponentHandle) params.set("opponentHandle", context.opponentHandle);
  if (context.winnerHandle) params.set("winnerHandle", context.winnerHandle);
  if (context.loserHandle) params.set("loserHandle", context.loserHandle);
  if (context.mode) params.set("mode", context.mode);
  if (context.token) params.set("token", context.token);
  if (context.reward !== undefined) params.set("reward", String(context.reward));
  if (context.season) params.set("season", context.season);
  if (context.won !== undefined) params.set("won", context.won ? "1" : "0");
  if (context.fighter) params.set("fighter", context.fighter);
  if (context.oppFighter) params.set("oppFighter", context.oppFighter);
  if (context.title) params.set("title", context.title);
  if (context.description) params.set("description", context.description);
  const query = params.toString();
  return `${PROD_ORIGIN}/api/share/og${query ? `?${query}` : ""}`;
}

export function buildShareMeta(opts: {
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
  buttonTitle?: string;
}) {
  const imageUrl = opts.imageUrl ?? `${PROD_ORIGIN}/image.jpg`;
  const buttonTitle = opts.buttonTitle ?? "Launch FarAction";
  return [
    { property: "og:title", content: opts.title },
    { property: "og:description", content: opts.description },
    { property: "og:image", content: imageUrl },
    { property: "og:url", content: opts.url },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: imageUrl },
    { name: "twitter:title", content: opts.title },
    { name: "twitter:description", content: opts.description },
    ...frameMeta({
      url: opts.url,
      title: buttonTitle,
      imageUrl,
    }),
  ];
}

export function buildShareCardSvg(context: SharePreviewContext = {}): string {
  const host = normalizeHandle(context.hostHandle, "alice");
  const opponent = normalizeHandle(context.opponentHandle, "bob");
  const winner = normalizeHandle(context.winnerHandle, "alice");
  const loser = normalizeHandle(context.loserHandle, "bob");
  const matchId = context.matchId ? context.matchId.toUpperCase() : "FAR12345";
  const seasonLabel = context.season ?? "Season 2 • The Rise of Junkies";
  const reward = formatReward(context.reward);
  const mode = context.mode ?? "1v1";

  let title = "@alice vs @bob";
  let subtitle = "FarAction 1v1";
  let kicker = "Season 2 • The Rise of Junkies";

  if (context.kind === "challenge") {
    title = `@${host} vs @${opponent}`;
    subtitle = mode === "House Boss" ? "House Boss" : "1v1 Battle";
    kicker = seasonLabel;
  } else if (context.kind === "result") {
    title = `🏆 @${winner} WON`;
    subtitle = `FarAction ${mode}`;
    kicker = reward ? `${reward} earned` : `Winner: @${winner}`;
  } else if (context.kind === "reward") {
    title = `+${reward || "FACTS"}`;
    subtitle = "FarAction rewards";
    kicker = `Winner: @${winner}`;
  } else if (context.kind === "leaderboard") {
    title = `🏆 Rank ${matchId}`;
    subtitle = "FarAction season standings";
    kicker = seasonLabel;
  } else {
    title = `@${host} vs @${opponent}`;
    subtitle = kindLabel(context.kind);
    kicker = seasonLabel;
  }

  if (context.title) title = context.title;
  if (context.description) subtitle = context.description;

  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeSubtitle = subtitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeKicker = kicker.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeMatchId = matchId.replace(/&/g, "&amp;");
  const resultText = reward || "Challenge live";

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="FarAction battle preview">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#090d15" />
        <stop offset="50%" stop-color="#121b29" />
        <stop offset="100%" stop-color="#0a0f16" />
      </linearGradient>
      <linearGradient id="accent" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stop-color="#7af7d3" />
        <stop offset="100%" stop-color="#7ab2ff" />
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="1040" cy="120" r="220" fill="#27d4a3" opacity="0.12"/>
    <circle cx="110" cy="540" r="200" fill="#6ea8ff" opacity="0.12"/>
    <rect x="72" y="66" width="1056" height="498" rx="30" fill="rgba(10,17,24,0.68)" stroke="rgba(122,247,211,0.4)"/>
    <text x="96" y="134" fill="#7af7d3" font-size="26" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="3">FARACTION</text>
    <text x="96" y="170" fill="#dfeaf8" font-size="20" font-family="Arial, Helvetica, sans-serif" opacity="0.8">${safeSubtitle}</text>
    <text x="96" y="248" fill="#f7fbff" font-size="60" font-family="Arial, Helvetica, sans-serif" font-weight="800">${safeTitle}</text>
    <text x="96" y="312" fill="#7ab2ff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="700">${safeKicker}</text>
    <g>
      <rect x="96" y="366" width="210" height="122" rx="20" fill="rgba(122,247,211,0.08)" stroke="rgba(122,247,211,0.35)"/>
      <text x="118" y="410" fill="#7af7d3" font-size="16" font-family="Arial, Helvetica, sans-serif" letter-spacing="2.2">MATCH</text>
      <text x="118" y="452" fill="#f7fbff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="700">${safeMatchId}</text>
    </g>
    <g>
      <rect x="340" y="366" width="250" height="122" rx="20" fill="rgba(122,178,255,0.08)" stroke="rgba(122,178,255,0.35)"/>
      <text x="362" y="410" fill="#7ab2ff" font-size="16" font-family="Arial, Helvetica, sans-serif" letter-spacing="2.2">MODE</text>
      <text x="362" y="452" fill="#f7fbff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="700">${mode}</text>
    </g>
    <g>
      <rect x="624" y="366" width="276" height="122" rx="20" fill="rgba(122,247,211,0.08)" stroke="rgba(122,247,211,0.35)"/>
      <text x="646" y="410" fill="#7af7d3" font-size="16" font-family="Arial, Helvetica, sans-serif" letter-spacing="2.2">RESULT</text>
      <text x="646" y="452" fill="#f7fbff" font-size="25" font-family="Arial, Helvetica, sans-serif" font-weight="700">${resultText}</text>
    </g>
    <rect x="920" y="336" width="132" height="132" rx="18" fill="url(#accent)" opacity="0.16"/>
    <text x="954" y="430" fill="#f7fbff" font-size="68" font-family="Arial, Helvetica, sans-serif" font-weight="800">⚔️</text>
  </svg>
  `;
}

/** Absolute /api/share/og URL for a battle-result share card. */
export function resultShareImage(opts: {
  matchId?: string;
  won: boolean;
  me: string;
  opponent: string;
  mode?: string;
  reward?: number;
  fighter?: string;
  oppFighter?: string;
}): string {
  return shareImageUrl({
    kind: "result",
    matchId: opts.matchId,
    won: opts.won,
    winnerHandle: opts.won ? opts.me : opts.opponent,
    loserHandle: opts.won ? opts.opponent : opts.me,
    hostHandle: opts.me,
    opponentHandle: opts.opponent,
    mode: opts.mode,
    reward: opts.reward,
    fighter: opts.fighter,
    oppFighter: opts.oppFighter,
  });
}

/** Cast copy for a battle result, e.g. "I defeated @bob in FarAction ⚔️". */
export function resultCastText(opts: { won: boolean; opponent: string; reward?: number }): string {
  const opponent = normalizeHandle(opts.opponent);
  const verb = opts.won ? "defeated" : "lost to";
  const reward = opts.won ? formatReward(opts.reward) : "";
  const suffix = reward ? ` — earned ${reward}` : "";
  return `I ${verb} @${opponent} in FarAction ⚔️${suffix}`;
}

/**
 * Structured content for the result share card — shared by the SVG fallback
 * and the satori/PNG renderer so both stay in sync.
 */
export interface ResultCardData {
  wordmark: "WIN" | "DEFEAT";
  winner: string;
  loser: string;
  mode: string;
  rewardLabel: string;
  fighter?: string | undefined;
  oppFighter?: string | undefined;
}

export function resolveResultCard(context: SharePreviewContext): ResultCardData {
  const winner = normalizeHandle(context.winnerHandle, "alice");
  const loser = normalizeHandle(context.loserHandle, "bob");
  const won = context.won ?? true;
  return {
    wordmark: won ? "WIN" : "DEFEAT",
    winner,
    loser,
    mode: context.mode ?? "1v1",
    rewardLabel: formatReward(context.reward),
    fighter: context.fighter,
    oppFighter: context.oppFighter,
  };
}
