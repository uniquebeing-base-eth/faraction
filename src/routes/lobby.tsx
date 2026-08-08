import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Check, Share2, Swords, X, Crown, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Screen } from "@/components/Screen";
import { CHARACTERS } from "@/lib/game/gameData";
import { usePlayer, displayHandle } from "@/lib/game/store";
import {
  activeFromRecord,
  castText,
  ENTRY_FEE_USDC,
  clearActiveMatch,
  formatAmount,
  inviteLink,
  loadActiveMatch,
  modeLabel,
  potFor,
  saveActiveMatch,
  type ActiveMatch,
  type MatchRecord,
} from "@/lib/game/match";
import { fetchMatch, listMyMatches, markMatchPaid, updateMatchStatus } from "@/lib/matches.functions";
import { sfx } from "@/lib/sound";
import { shareCast } from "@/lib/share";
import { chargeEntryFee } from "@/lib/payment-flows";
import { useTokenBalances } from "@/lib/onchain/balances";

export const Route = createFileRoute("/lobby")({
  head: () => ({
    meta: [
      { title: "Match Lobby — FarAction" },
      {
        name: "description",
        content:
          "Your FarAction match lobby: copy the invite link, share it on Farcaster, and start the battle.",
      },
      { property: "og:title", content: "Match Lobby — FarAction" },
      { property: "og:description", content: "Share your invite link and start the bout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  const navigate = useNavigate();
  const { player } = usePlayer();
  const [match, setMatch] = useState<ActiveMatch | null>(null);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [opponentIn, setOpponentIn] = useState(false);
  const [feeError, setFeeError] = useState("");
  const wallet = useTokenBalances();

  const resolve = useServerFn(fetchMatch);
  const mine = useServerFn(listMyMatches);
  const setPaid = useServerFn(markMatchPaid);
  const setStatus = useServerFn(updateMatchStatus);

  // Restore the bout: the local record first, otherwise whatever the backend
  // still has open for this player, so closing the app never loses a match.
  useEffect(() => {
    let cancelled = false;
    const local = loadActiveMatch();
    if (local) {
      setMatch(local);
      setLink(inviteLink(local));
      if (local.mode === "house") setOpponentIn(true);
      return;
    }
    void mine({ data: { handle: displayHandle(player) } })
      .then((rows) => {
        if (cancelled) return;
        const row = (rows as unknown as MatchRecord[])[0];
        if (!row) {
          navigate({ to: "/create-match" });
          return;
        }
        const role =
          row.host_handle.toLowerCase() === displayHandle(player).toLowerCase() ? "host" : "joiner";
        const restored = activeFromRecord(row, role);
        saveActiveMatch(restored);
        setMatch(restored);
        setLink(inviteLink(restored));
        if (restored.mode === "house" || row.joiner_handle) setOpponentIn(true);
      })
      .catch(() => navigate({ to: "/create-match" }));
    return () => {
      cancelled = true;
    };
  }, [navigate, mine, player]);

  // Live seat state — the host sees the opponent arrive without refreshing.
  const live = useQuery({
    queryKey: ["match-state", match?.id],
    enabled: Boolean(match?.id) && match?.mode !== "house",
    refetchInterval: 6_000,
    queryFn: () => resolve({ data: { matchId: match!.id } }),
  });

  const liveRow = live.data as unknown as MatchRecord | null | undefined;

  useEffect(() => {
    if (!liveRow || !match) return;
    if (liveRow.joiner_handle) {
      setOpponentIn(true);
      if (match.joinerHandle !== liveRow.joiner_handle) {
        const next: ActiveMatch = { ...match, joinerHandle: liveRow.joiner_handle };
        saveActiveMatch(next);
        setMatch(next);
        sfx.bell();
      }
    }
  }, [liveRow, match]);

  /**
   * Step 3 of the payment flow — both seats are filled and ready, so the
   * 0.01 USDC entry fee moves to the treasury and is verified server-side.
   * The match only begins after that confirmation.
   */
  const ready = useMutation({
    mutationFn: async (m: ActiveMatch) => {
      if (m.entryReceiptId) return m.entryReceiptId;
      const reference = m.role === "joiner" ? `${m.id}:joiner` : m.id;
      const receipt = await chargeEntryFee({
        matchId: reference,
        mode: m.mode,
        payer: displayHandle(player),
      });
      return receipt.id;
    },
    onSuccess: (receiptId) => {
      sfx.bell();
      void wallet.refetch();
      const current = loadActiveMatch();
      if (!current) return;
      void setPaid({ data: { matchId: current.id, role: current.role } }).catch(() => undefined);
      const next: ActiveMatch = {
        ...current,
        paid: true,
        entryReceiptId: receiptId,
      };
      saveActiveMatch(next);
      setMatch(next);
      navigate({ to: player.deck.length === 5 ? "/play" : "/loadout" });
    },
    onError: (e) =>
      setFeeError(
        e instanceof Error && e.message
          ? e.message
          : `The ${ENTRY_FEE_USDC.toFixed(2)} USDC entry fee could not be confirmed.`,
      ),
  });

  if (!match) return null;

  const { pot, winnerTake, fee } = potFor(match);
  const host = CHARACTERS.find((c) => c.id === match.hostFighterId) ?? CHARACTERS[0]!;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      sfx.coin();
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const invited = match.invitedUsername?.replace(/^@/, "");

  const share = () => {
    sfx.tap();
    const text = invited
      ? `@${invited} ${castText(match)}`
      : castText(match);
    void shareCast(text, link);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(match.id);
      sfx.coin();
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const cancel = () => {
    sfx.tap();
    // Stakes are escrowed onchain, so tearing the match down here only clears
    // the local match record — refunds settle through the vault contract.
    if (match) void setStatus({ data: { matchId: match.id, status: "cancelled" } }).catch(() => undefined);
    clearActiveMatch();
    navigate({ to: "/" });
  };

  const start = () => {
    setFeeError("");
    if (match) ready.mutate(match);
  };

  return (
    <Screen
      title="Match Lobby"
      back="/"
      eyebrow={`${modeLabel(match.mode)} · ${match.role === "host" ? "You are host" : "You joined"}`}
      heading={match.id}
      blurb={
        match.mode === "house"
          ? "The House is already at the table. Lock your five-slot sequence and take the bout."
          : "Share the invite link. Your friend opens it inside Farcaster and drops straight into this match."
      }
      aside={
        <div className="space-y-2">
          <div className="panel space-y-1.5 p-4">
            <Row k="Mode" v={modeLabel(match.mode)} />
            <Row
              k="Stake each"
              v={match.staked ? formatAmount(match.stake, match.token) : "None"}
            />
            <Row k="Pot" v={match.staked ? formatAmount(pot, match.token) : "Points only"} />
            <Row
              k="Winner takes 90%"
              v={match.staked ? formatAmount(winnerTake, match.token) : "—"}
              accent
            />
            <Row k="Platform 10%" v={match.staked ? formatAmount(fee, match.token) : "—"} />
          </div>
          <div className="rounded-lg border border-border/70 bg-card/40 p-3">
            <p className="label-xs">Entry fee — charged when you go ready</p>
            <p className="font-display text-sm font-bold text-usdc">
              {ENTRY_FEE_USDC.toFixed(2)} USDC → treasury
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Stakes are already escrowed in the vault. The bout starts only after this payment
              confirms onchain.
            </p>
          </div>
          {feeError ? <p className="text-xs text-strike">{feeError}</p> : null}
          <button
            type="button"
            onClick={start}
            disabled={!opponentIn || ready.isPending}
            className="fa-btn w-full disabled:opacity-40"
          >
            {ready.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Swords className="size-4" />
            )}
            {ready.isPending
              ? "Confirming entry fee…"
              : !opponentIn
                ? "Waiting for opponent"
                : match.entryReceiptId
                  ? "Start battle"
                  : `Ready · pay ${ENTRY_FEE_USDC.toFixed(2)} USDC`}
          </button>
          <button type="button" onClick={cancel} className="fa-btn-ghost w-full">
            <X className="size-4" /> Cancel match
          </button>
        </div>
      }
    >
      <div className="fa-scroll flex h-full flex-col gap-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Seat name={match.hostHandle} role="Host" art={host.fullArt} colour={host.color} ready />
          <span className="font-display text-2xl font-bold text-muted-foreground">VS</span>
          <Seat
            name={
              match.mode === "house"
                ? "The House"
                : (match.joinerHandle ??
                  (invited ? `@${invited}` : opponentIn ? "Challenger" : "Open seat"))
            }
            role={
              match.mode === "house"
                ? "House AI"
                : !match.joinerHandle && invited
                  ? "Challenged · awaiting accept"
                  : "Player 2"
            }
            art={match.mode === "house" ? CHARACTERS[3]!.fullArt : undefined}
            colour="var(--accent)"
            ready={opponentIn}
          />
        </div>

        {match.mode !== "house" ? (
          <div className="space-y-2">
            <p className="label-xs">Invite code</p>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-facts/60 bg-facts/10 px-4 py-2 font-display text-xl font-bold tracking-[0.2em] text-facts">
                {match.id}
              </span>
              <button type="button" onClick={copyCode} className="fa-btn-ghost shrink-0">
                {codeCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {codeCopied ? "Copied" : "Copy code"}
              </button>
              <button type="button" onClick={share} className="fa-btn shrink-0">
                <Share2 className="size-4" /> Invite on Farcaster
              </button>
            </div>
            <p className="label-xs">Invite link</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-border/70 bg-card/50 px-3 py-2.5 font-mono text-[11px] text-foreground/85"
              />
              <button type="button" onClick={copy} className="fa-btn shrink-0">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" onClick={share} className="fa-btn-ghost shrink-0">
                <Share2 className="size-4" /> Cast
              </button>
            </div>
            <ol className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
              <li>1 · Copy the link or cast it to your friend.</li>
              <li>2 · They open it inside Farcaster and confirm the same stake.</li>
              <li>3 · Both sides lock a five-slot sequence and the pot settles to the winner.</li>
            </ol>
            {!opponentIn ? (
              <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Waiting for your opponent to accept…
              </p>
            ) : null}
          </div>
        ) : (
          <div className="panel flex items-center gap-3 p-4">
            <Crown className="size-5 shrink-0 text-facts" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              House Boss run. Clear the 5/5 streak to climb toward the 100,000,000 $FACTS season
              reward pool — every staked win also pays 90% of the pot straight back to your balance.
            </p>
          </div>
        )}

        <Link to="/loadout" className="fa-btn-ghost self-start">
          Edit loadout
        </Link>
      </div>
    </Screen>
  );
}

function Seat({
  name,
  role,
  art,
  colour,
  ready,
}: {
  name: string;
  role: string;
  art?: string | undefined;
  colour: string;
  ready: boolean;
}) {
  return (
    <div
      className={`relative flex h-40 flex-col justify-end overflow-hidden rounded-lg border p-3 ${
        ready ? "border-accent/60 bg-accent/5" : "border-dashed border-border/70 bg-card/30"
      }`}
    >
      {art ? (
        <img
          loading="lazy"
          decoding="async"
          src={art}
          alt=""
          className="absolute inset-0 size-full object-cover object-top opacity-45"
        />
      ) : null}
      <div className="relative">
        <p className="label-xs" style={{ color: colour }}>
          {role}
        </p>
        <p className="truncate font-display text-sm font-bold">{name}</p>
        <p className="label-xs">{ready ? "Ready" : "Waiting…"}</p>
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="label-xs">{k}</span>
      <span className={`font-display text-xs ${accent ? "text-facts" : ""}`}>{v}</span>
    </div>
  );
}
