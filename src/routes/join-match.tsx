import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogIn, Link2, Swords, Loader2, Lock, Trophy, RefreshCw } from "lucide-react";
import { z } from "zod";
import { Screen } from "@/components/Screen";
import { CHARACTERS } from "@/lib/game/gameData";
import { usePlayer, passIsActive, displayHandle } from "@/lib/game/store";
import { useTokenBalances } from "@/lib/onchain/balances";

import { joinStakedMatch } from "@/lib/onchain/actions";
import { fetchMatch, joinMatchRecord, listOpenRankedMatches } from "@/lib/matches.functions";
import { pushActivity } from "@/lib/activity";
import { PROD_ORIGIN } from "@/lib/config";
import {
  configFromRecord,
  decodeMatch,
  ENTRY_FEE_USDC,
  isMatchCode,
  normalizeMatchCode,
  requiresSeasonPass,
  formatAmount,
  modeLabel,
  potFor,
  saveActiveMatch,
  type MatchConfig,
  type MatchRecord,
} from "@/lib/game/match";
import { sfx } from "@/lib/sound";
import { addMiniApp } from "@/lib/miniapp";

const searchSchema = z.object({
  m: z.string().optional(),
  code: z.string().optional(),
});

export const Route = createFileRoute("/join-match")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Join Match — FarAction" },
      {
        name: "description",
        content:
          "Open a FarAction invite link, match the stake, and drop straight into the battle on Base.",
      },
      { property: "og:title", content: "Join Match — FarAction" },
      { property: "og:description", content: "Paste an invite link or code and join the bout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinMatch,
});

/**
 * Accepts anything a host can paste: a full invite link, an invite link with
 * the payload in the hash, or the raw FAR match code.
 */
function tokenFrom(input: string): { code: string | null; payload: string | null } {
  const trimmed = input.trim().replace(/\s+/g, "");
  if (!trimmed) return { code: null, payload: null };
  try {
    const url = new URL(trimmed);
    const last = url.pathname.split("/").filter(Boolean).pop() ?? "";
    const payload = url.searchParams.get("m") ?? new URLSearchParams(url.hash.replace(/^#/, "")).get("m");
    return { code: isMatchCode(last) ? normalizeMatchCode(last) : null, payload };
  } catch {
    if (isMatchCode(trimmed)) return { code: normalizeMatchCode(trimmed), payload: null };
    return { code: null, payload: trimmed };
  }
}

function JoinMatch() {
  const { m, code: codeParam } = Route.useSearch();
  const navigate = useNavigate();
  const { player } = usePlayer();
  const wallet = useTokenBalances();

  const [input, setInput] = useState(codeParam ?? m ?? "");
  const [match, setMatch] = useState<MatchConfig | null>(null);
  const [error, setError] = useState("");
  const [looking, setLooking] = useState(false);

  const resolve = useServerFn(fetchMatch);
  const joinRecord = useServerFn(joinMatchRecord);
  const listRanked = useServerFn(listOpenRankedMatches);

  const openRanked = useQuery({
    queryKey: ["open-ranked-matches"],
    queryFn: () => listRanked({ data: {} }),
    refetchInterval: 15_000,
  });

  /** Codes always win: the database record is the source of truth. */
  const lookupValue = useCallback(
    async (value: string) => {
      const { code, payload } = tokenFrom(value);
      setLooking(true);
      try {
        if (code) {
          const row = await resolve({ data: { matchId: code } });
          if (row) {
            setError("");
            setMatch(configFromRecord(row as unknown as MatchRecord));
            sfx.select();
            return;
          }
        }
        const decoded = payload ? decodeMatch(payload) : null;
        if (decoded) {
          setError("");
          setMatch(decoded);
          sfx.select();
          return;
        }
        setMatch(null);
        setError("No open match with that link or code. Ask your friend to send it again.");
      } catch (e) {
        setMatch(null);
        setError(e instanceof Error ? e.message : "Could not look that match up.");
      } finally {
        setLooking(false);
      }
    },
    [resolve],
  );

  useEffect(() => {
    const initial = codeParam ?? m;
    if (initial) void lookupValue(initial);
  }, [codeParam, m, lookupValue]);

  const joining = useMutation({
    mutationFn: async (cfg: MatchConfig) => {
      // Step 2 of the payment flow: match the stake onchain. The entry fee is
      // charged in the lobby once both players are ready.
      if (cfg.staked) await joinStakedMatch(cfg.id);
      return await joinRecord({
        data: {
          matchId: cfg.id,
          handle: displayHandle(player),
          fid: player.fid,
          wallet: wallet.address ?? null,
          fighterId: player.fighterId || CHARACTERS[0]!.id,
        },
      });
    },
    onSuccess: (row) => {
      if (!match) return;
      sfx.coin();
      void wallet.refetch();
      void addMiniApp().catch(() => undefined);
      saveActiveMatch({
        ...configFromRecord(row as unknown as MatchRecord),
        role: "joiner",
        joinerHandle: displayHandle(player),
        joinerFighterId: player.fighterId,
        paid: false,
      });
      pushActivity("win", `${displayHandle(player)} joined ${modeLabel(match.mode)} ${match.id}`);
      navigate({ to: "/lobby" });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not join this match."),
  });

  const join = () => {
    if (!match) return;
    if (requiresSeasonPass(match.mode) && !passIsActive(player)) {
      setError("Ranked Matches require an active Season Pass.");
      return;
    }
    const balance = match.token === "USDC" ? wallet.usdc : wallet.facts;
    if (match.staked && balance < match.stake) {
      setError(`You need ${formatAmount(match.stake, match.token)} to match this stake.`);
      return;
    }
    setError("");
    joining.mutate(match);
  };

  const host = match
    ? (CHARACTERS.find((c) => c.id === match.hostFighterId) ?? CHARACTERS[0]!)
    : null;
  const economics = match ? potFor(match) : null;
  const ranked = (openRanked.data ?? []) as unknown as MatchRecord[];

  return (
    <Screen
      title="Join Match"
      eyebrow="Invite link"
      heading="Join a battle"
      blurb="Paste an invite code, open a link, or jump into any Ranked bout waiting for an opponent."
      aside={
        <div className="space-y-2">
          {match && economics ? (
            <div className="panel space-y-1.5 p-4">
              <Row k="Match" v={match.id} />
              <Row k="Mode" v={modeLabel(match.mode)} />
              <Row k="Host" v={match.hostHandle} />
              <Row
                k="Stake each"
                v={match.staked ? formatAmount(match.stake, match.token) : "None"}
              />
              <Row k="Entry fee (at ready)" v={`${ENTRY_FEE_USDC.toFixed(2)} USDC`} />
              <Row
                k="Winner takes 90%"
                v={match.staked ? formatAmount(economics.winnerTake, match.token) : "Points only"}
                accent
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Paste the invite link your friend shared, or the match code (FAR0000000).
            </p>
          )}
          {error ? <p className="text-xs text-strike">{error}</p> : null}
          <button
            type="button"
            onClick={match ? join : () => void lookupValue(input)}
            disabled={joining.isPending || looking}
            className="fa-btn w-full disabled:opacity-50"
          >
            {joining.isPending || looking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : match && requiresSeasonPass(match.mode) && !passIsActive(player) ? (
              <Lock className="size-4" />
            ) : match ? (
              <Swords className="size-4" />
            ) : (
              <LogIn className="size-4" />
            )}
            {match
              ? match.staked
                ? `Match ${formatAmount(match.stake, match.token)} & join`
                : "Join battle"
              : "Find match"}
          </button>
        </div>
      }
    >
      <div className="fa-scroll flex h-full flex-col gap-4 overflow-y-auto pr-1">
        <div>
          <p className="label-xs">Invite link or code</p>
          <div className="mt-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void lookupValue(input);
              }}
              placeholder={`${PROD_ORIGIN}/match/… or FAR1234567`}
              className="min-w-0 flex-1 rounded-lg border border-border/70 bg-card/50 px-3 py-2.5 text-xs outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => void lookupValue(input)}
              className="fa-btn-ghost shrink-0"
            >
              <Link2 className="size-4" /> Check
            </button>
          </div>
        </div>

        {match && host ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Card
              title={match.hostHandle}
              sub={`${host.name} · ${host.className}`}
              art={host.fullArt}
            />
            <span className="font-display text-2xl font-bold text-muted-foreground">VS</span>
            <Card
              title={displayHandle(player)}
              sub="You"
              art={(CHARACTERS.find((c) => c.id === player.fighterId) ?? CHARACTERS[0]!).fullArt}
            />
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between">
            <p className="label-xs">Open Ranked matches</p>
            <button
              type="button"
              onClick={() => void openRanked.refetch()}
              className="fa-chip"
              aria-label="Refresh open matches"
            >
              <RefreshCw className={`size-3.5 ${openRanked.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          {ranked.length ? (
            <ul className="mt-2 space-y-1.5">
              {ranked.map((row) => (
                <li key={row.match_id}>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.select();
                      setInput(row.match_id);
                      setError("");
                      setMatch(configFromRecord(row));
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-2.5 text-left transition-colors hover:border-accent/70"
                  >
                    <Trophy className="size-4 shrink-0 text-facts" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-xs font-bold">
                        {row.host_handle}
                      </span>
                      <span className="label-xs">
                        {row.match_id} ·{" "}
                        {row.staked
                          ? formatAmount(Number(row.stake), row.token === "USDC" ? "USDC" : "FACTS")
                          : "Unstaked"}
                      </span>
                    </span>
                    <Swords className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
              No Ranked bouts waiting right now. Open one from Create Match and everyone gets
              notified.
            </p>
          )}
        </div>
      </div>
    </Screen>
  );
}

function Card({ title, sub, art }: { title: string; sub: string; art: string }) {
  return (
    <div className="relative h-44 overflow-hidden rounded-lg border border-accent/50 bg-card/40 p-3">
      <img
        loading="lazy"
        decoding="async"
        src={art}
        alt=""
        className="absolute inset-0 size-full object-cover object-top opacity-45"
      />
      <div className="relative flex h-full flex-col justify-end">
        <p className="truncate font-display text-sm font-bold">{title}</p>
        <p className="label-xs">{sub}</p>
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
