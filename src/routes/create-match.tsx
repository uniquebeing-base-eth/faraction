import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Crown,
  Swords,
  Coins,
  Zap,
  Check,
  Trophy,
  Lock,
  Loader2,
  Send,
  Copy,
  ArrowRight,
  X,
} from "lucide-react";
import { Screen } from "@/components/Screen";
import { usePlayer, passIsActive, displayHandle, normalizeHandle } from "@/lib/game/store";
import { useTokenBalances } from "@/lib/onchain/balances";

import { CHARACTERS } from "@/lib/game/gameData";
import {
  ENTRY_FEE_USDC,
  STAKE_PRESETS,
  formatAmount,
  modeLabel,
  newMatchId,
  potFor,
  inviteLink,
  encodeMatch,
  requiresSeasonPass,
  saveActiveMatch,
  type MatchMode,
  type StakeToken,
} from "@/lib/game/match";
import { createStakedMatch } from "@/lib/onchain/actions";
import { createChallenge } from "@/lib/neynar.functions";
import { createMatchRecord, listMyMatches, updateMatchStatus } from "@/lib/matches.functions";
import { FarcasterSearch } from "@/components/FarcasterSearch";
import type { FarcasterUser } from "@/lib/neynar.server";
import { useFactsPrice, formatFactsAmount } from "@/lib/facts-price";
import { pushActivity } from "@/lib/activity";
import { shareCast } from "@/lib/share";
import { promptAddMiniApp } from "@/lib/miniapp";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/create-match")({
  head: () => ({
    meta: [
      { title: "Create Match — FarAction" },
      {
        name: "description",
        content:
          "Open a FarAction match on Base: Ranked, House Boss or a 1 vs 1 challenge sent straight to a Farcaster friend.",
      },
      { property: "og:title", content: "Create Match — FarAction" },
      {
        property: "og:description",
        content: "Pick Ranked, House Boss or 1 vs 1, set your stake, and send the invite.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateMatch,
});

const MODES: { key: MatchMode; label: string; sub: string; desc: string; Icon: typeof Crown }[] = [
  {
    key: "ranked",
    label: "Ranked",
    sub: "Season Pass only",
    desc: "Competitive ladder play. Counts toward the Season Leaderboard and the 100,000,000 $FACTS reward pool.",
    Icon: Trophy,
  },
  {
    key: "house",
    label: "House Boss",
    sub: "5-fight streak",
    desc: "Face the House AI. Clear the streak and stack rewards — no Season Pass required.",
    Icon: Crown,
  },
  {
    key: "1v1",
    label: "1 vs 1",
    sub: "Invite battle",
    desc: "Challenge any Farcaster user or FarAction player. Free to join without a pass.",
    Icon: Swords,
  },
];

const DIFFICULTIES = [
  { value: 0, label: "Easy", mult: "1× pts", color: "var(--defense)" },
  { value: 1, label: "Moderate", mult: "1.5× pts", color: "var(--facts)" },
  { value: 2, label: "Hard", mult: "2× pts", color: "var(--strike)" },
] as const;

function CreateMatch() {
  const { player, update } = usePlayer();
  const wallet = useTokenBalances();

  const navigate = useNavigate();
  const { price } = useFactsPrice();

  const [mode, setMode] = useState<MatchMode>("house");
  const [staked, setStaked] = useState(false);
  const [token, setToken] = useState<StakeToken>("FACTS");
  const [stake, setStake] = useState<number>(STAKE_PRESETS.FACTS[1]!);
  const [difficulty, setDifficulty] = useState<0 | 1 | 2>(1);
  const [opponent, setOpponent] = useState<FarcasterUser | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: string; link: string; code: string } | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const challenge = useServerFn(createChallenge);
  const persist = useServerFn(createMatchRecord);
  const mine = useServerFn(listMyMatches);
  const setStatus = useServerFn(updateMatchStatus);

  // A player may only ever have one live 1 vs 1 open at a time — otherwise
  // invites pile up and opponents land in the wrong lobby.
  const pending = useQuery({
    queryKey: ["my-matches", displayHandle(player)],
    queryFn: () => mine({ data: { handle: displayHandle(player) } }),
    staleTime: 10_000,
  });
  const pendingRow = (pending.data as unknown as { match_id: string; mode: string; status: string }[] | undefined)?.find(
    (r) => r.mode === "1v1" && (r.status === "open" || r.status === "locked"),
  );
  const blockedBy1v1 = mode === "1v1" && !created && Boolean(pendingRow);

  const cancelPending = useMutation({
    mutationFn: async () => {
      if (!pendingRow) return;
      await setStatus({ data: { matchId: pendingRow.match_id, status: "cancelled" } });
    },
    onSuccess: () => {
      sfx.tap();
      void pending.refetch();
    },
  });

  const pass = passIsActive(player);
  const passLocked = requiresSeasonPass(mode) && !pass;
  const { pot, winnerTake, fee } = potFor({ staked, stake });
  const balance = token === "USDC" ? wallet.usdc : wallet.facts;
  const feeInFacts = price ? formatFactsAmount(ENTRY_FEE_USDC / price) : null;

  const create = useMutation({
    mutationFn: async () => {
      const id = newMatchId();
      const fighterId = player.fighterId || CHARACTERS[0]!.id;
      // Step 1 of the payment flow: the creator only locks the stake here.
      // The 0.01 USDC entry fee is charged later, in the lobby, once both
      // sides are confirmed and ready.
      if (staked) {
        await createStakedMatch({ matchKey: id, asset: token, stake });
      }

      // Persist first: the invite code has to resolve for the opponent even if
      // the host closes the app straight after casting the challenge.
      await persist({
        data: {
          matchId: id,
          mode,
          staked,
          token,
          stake: staked ? stake : 0,
          difficulty,
          hostHandle: displayHandle(player),
          hostFid: player.fid,
          hostWallet: wallet.address ?? null,
          hostFighterId: fighterId,
          invitedUsername: mode === "1v1" && opponent ? opponent.username : null,
          invitedFid: mode === "1v1" && opponent && opponent.fid > 0 ? opponent.fid : null,
        },
      });

      let invitedUsername: string | undefined;
      if (mode === "1v1" && opponent) {
        const sent = await challenge({
          data: {
            matchId: id,
            fromHandle: displayHandle(player),
            toUsername: opponent.username,
            toFid: opponent.fid > 0 ? opponent.fid : null,
          },
        });
        invitedUsername = opponent.username;
        // Cast the challenge while waiting for the player to accept.
        void shareCast(sent.castText, sent.inviteUrl);
      }
      return { id, invitedUsername };
    },
    onSuccess: ({ id, invitedUsername }) => {
      sfx.coin();
      // Creating a match is a real user gesture — the right moment to ask for
      // the mini app + notification permission natively.
      void promptAddMiniApp().catch(() => undefined);
      // Fees and stakes leave the wallet onchain — re-read the live balances.
      void wallet.refetch();

      const cfg = {
        id,
        mode,
        staked,
        token,
        stake: staked ? stake : 0,
        difficulty,
        hostHandle: displayHandle(player),
        hostFighterId: player.fighterId || CHARACTERS[0]!.id,
        ...(player.fid ? { hostFid: player.fid } : {}),
        createdAt: Date.now(),
      };
      saveActiveMatch({
        ...cfg,
        role: "host",
        paid: false,
        ...(invitedUsername ? { invitedUsername } : {}),
      });
      pushActivity("win", `${displayHandle(player)} opened a ${modeLabel(mode)}`);
      // Surface the invite link + code straight away so the host can paste it
      // anywhere; the lobby is one click further on.
      setCreated({ id, link: inviteLink(cfg), code: encodeMatch(cfg) });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not create the match."),
  });

  const start = () => {
    if (passLocked) {
      setError("Ranked Mode requires an active Season Pass.");
      return;
    }
    if (blockedBy1v1 && pendingRow) {
      setError(
        `You already have a pending 1 vs 1 (${pendingRow.match_id}). Finish or cancel it first.`,
      );
      return;
    }
    if (staked && balance < stake) {
      setError(`Not enough ${token}. You hold ${formatAmount(balance, token)}.`);
      return;
    }
    setError("");
    create.mutate();
  };

  return (
    <Screen
      title="Create Match"
      back="/"
      eyebrow="Match maker"
      heading="Open a new bout"
      blurb="Choose your mode, set the stake, and lock the pot. Winner takes 90% — the platform keeps 10%."
      aside={
        created ? (
          <div className="space-y-2">
            <div className="panel space-y-3 p-4">
              <div>
                <p className="label-xs">Match code</p>
                <p className="font-display text-lg font-bold tracking-widest text-accent">
                  {created.id}
                </p>
              </div>
              <div>
                <p className="label-xs">Invite link</p>
                <p className="mt-1 truncate rounded-md border border-border/70 bg-card/50 px-2 py-1.5 text-[10px]">
                  {created.link}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(created.link);
                    setCopied("link");
                    sfx.tap();
                  }}
                  className="fa-btn-ghost mt-2 w-full"
                >
                  {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied === "link" ? "Link copied" : "Copy invite link"}
                </button>
              </div>
              <div>
                <p className="label-xs">Join code (paste on Join Match)</p>
                <p className="mt-1 truncate rounded-md border border-border/70 bg-card/50 px-2 py-1.5 font-mono text-[10px]">
                  {created.code}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(created.code);
                    setCopied("code");
                    sfx.tap();
                  }}
                  className="fa-btn-ghost mt-2 w-full"
                >
                  {copied === "code" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied === "code" ? "Code copied" : "Copy join code"}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/lobby" })}
              className="fa-btn w-full"
            >
              <ArrowRight className="size-4" /> Enter lobby
            </button>
            <button
              type="button"
              onClick={() => {
                sfx.tap();
                const to = opponent ? `@${normalizeHandle(opponent.username)} ` : "";
                void shareCast(
                  `${to}FarAction ${modeLabel(mode)} open — code ${created.id}. Tap in and take me on ⚔️`,
                  created.link,
                );
              }}
              className="fa-btn-ghost w-full"
            >
              <Send className="size-4" /> Cast the invite
            </button>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Anyone with the link or the join code can enter this bout from the Join Match screen.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
          <div className="panel space-y-1.5 p-4">
            <Row k="Mode" v={modeLabel(mode)} />
            <Row
              k="Entry fee (at ready)"
              v={`${ENTRY_FEE_USDC.toFixed(2)} USDC${feeInFacts ? ` · ≈${feeInFacts} FACTS` : ""}`}
            />
            <Row k="Season Pass" v={pass ? "Active" : "None"} accent={pass} />
            {staked ? (
              <>
                <Row k="Your stake" v={formatAmount(stake, token)} />
                <Row k="Pot" v={formatAmount(pot, token)} />
                <Row k="Winner takes" v={formatAmount(winnerTake, token)} accent />
                <Row k="Platform 10%" v={formatAmount(fee, token)} />
              </>
            ) : (
              <Row k="Stake" v="Unstaked · points only" />
            )}
          </div>
          {error ? <p className="text-xs text-strike">{error}</p> : null}
          {blockedBy1v1 && pendingRow ? (
            <div className="space-y-2 rounded-lg border border-strike/50 bg-strike/10 p-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                You already have a pending 1 vs 1 —{" "}
                <span className="font-display text-accent">{pendingRow.match_id}</span>. Finish it
                or cancel it before opening another.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/lobby" })}
                  className="fa-btn-ghost flex-1"
                >
                  Go to lobby
                </button>
                <button
                  type="button"
                  onClick={() => cancelPending.mutate()}
                  disabled={cancelPending.isPending}
                  className="fa-btn-ghost flex-1"
                >
                  {cancelPending.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                  Cancel it
                </button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={start}
            disabled={create.isPending || passLocked || blockedBy1v1}
            className="fa-btn w-full disabled:opacity-40"
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : passLocked || blockedBy1v1 ? (
              <Lock className="size-4" />
            ) : mode === "1v1" && opponent ? (
              <Send className="size-4" />
            ) : (
              <Swords className="size-4" />
            )}
            {blockedBy1v1
              ? "1 vs 1 already pending"
              : passLocked
              ? "Season Pass required"
              : create.isPending
                ? "Confirming payment…"
                : mode === "1v1" && opponent
                  ? `Challenge ${normalizeHandle(opponent.username)}`
                  : staked
                    ? `Lock ${formatAmount(stake, token)} & create`
                    : "Pay entry fee & create"}
          </button>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            The {ENTRY_FEE_USDC.toFixed(2)} USDC entry fee goes straight to the treasury and is
            verified by the backend before the match begins.
          </p>
          </div>
        )
      }
    >
      <div className="fa-scroll flex h-full flex-col gap-4 overflow-y-auto pr-1">
        <div>
          <p className="label-xs">Match mode</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {MODES.map(({ key, label, sub, desc, Icon }) => {
              const locked = requiresSeasonPass(key) && !pass;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    sfx.select();
                    setMode(key);
                    setError("");
                  }}
                  className={`relative rounded-lg border p-4 text-left transition-transform hover:-translate-y-0.5 ${
                    mode === key ? "border-accent bg-accent/10 glow" : "border-border/70 bg-card/40"
                  }`}
                >
                  {locked ? (
                    <Lock className="absolute top-3 right-3 size-3.5 text-muted-foreground" />
                  ) : null}
                  <Icon
                    className={`size-5 ${mode === key ? "text-accent" : "text-muted-foreground"}`}
                  />
                  <p className="mt-2 font-display text-base font-bold">{label}</p>
                  <p className="label-xs">{sub}</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {passLocked ? (
          <div className="flex items-center gap-3 rounded-lg border border-facts/50 bg-facts/10 p-3">
            <Lock className="size-4 shrink-0 text-facts" />
            <p className="text-[11px] text-muted-foreground">
              Ranked Matches, the Season Leaderboard and the 100,000,000 $FACTS reward pool need an
              active Season Pass. House Boss, 1 vs 1 and friend matches stay free.
            </p>
            <a href="/season-pass" className="fa-chip ml-auto shrink-0 border-facts/50 text-facts">
              Get pass
            </a>
          </div>
        ) : null}

        {mode === "1v1" ? (
          <div>
            <p className="label-xs">Challenge a player</p>
            <p className="mt-1 mb-2 text-[11px] text-muted-foreground">
              Search Farcaster or existing FarAction players, pick your opponent, and we&apos;ll
              cast the challenge while you wait for them to accept.
            </p>
            <FarcasterSearch selected={opponent} onSelect={setOpponent} />
          </div>
        ) : null}

        {mode === "house" ? (
          <div>
            <p className="label-xs">House difficulty</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    sfx.tap();
                    setDifficulty(d.value);
                  }}
                  className={`rounded-lg border p-2.5 text-center ${
                    difficulty === d.value ? "border-accent bg-accent/10" : "border-border/70"
                  }`}
                >
                  <p className="font-display text-xs font-bold" style={{ color: d.color }}>
                    {d.label}
                  </p>
                  <p className="label-xs">{d.mult}</p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between">
            <p className="label-xs">Staked match</p>
            <button
              type="button"
              onClick={() => {
                sfx.tap();
                setStaked((s) => !s);
              }}
              className={`fa-chip ${staked ? "border-facts/60 bg-facts/15 text-facts" : ""}`}
            >
              {staked ? <Check className="size-3.5" /> : null}
              {staked ? "Stake on" : "Stake off"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Both players stake the same amount. The winner claims 90% of the combined pot; 10% goes
            to the platform treasury.
          </p>

          {staked ? (
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                {(["FACTS", "USDC"] as StakeToken[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      sfx.tap();
                      setToken(t);
                      setStake(STAKE_PRESETS[t][1]!);
                    }}
                    className={`fa-chip flex-1 justify-center ${
                      token === t ? "border-accent bg-accent/10 text-accent" : ""
                    }`}
                  >
                    {t === "USDC" ? <Coins className="size-3.5" /> : <Zap className="size-3.5" />}
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {STAKE_PRESETS[token].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => {
                      sfx.tap();
                      setStake(amount);
                    }}
                    className={`rounded-lg border py-2.5 font-display text-xs ${
                      stake === amount ? "border-facts bg-facts/10 text-facts" : "border-border/70"
                    }`}
                  >
                    {token === "USDC" ? `$${amount}` : amount.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Screen>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="label-xs">{k}</span>
      <span className={`font-display ${accent ? "text-facts" : "text-foreground/90"}`}>{v}</span>
    </div>
  );
}
