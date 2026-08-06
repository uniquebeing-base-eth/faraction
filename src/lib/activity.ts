/**
 * Live activity feed. Ecosystem events stream through a single bus so any
 * surface can publish (matches, purchases, claims) and the ticker renders them.
 * Add a new `ActivityKind` to extend it — no other file needs to change.
 */
import { useEffect, useState } from "react";

export type ActivityKind = "buy" | "pass" | "win" | "claim" | "rank" | "house";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  text: string;
  at: number;
}

const MAX = 40;
let feed: ActivityEvent[] = [];
const listeners = new Set<(f: ActivityEvent[]) => void>();

function emit() {
  listeners.forEach((l) => l(feed));
}

export function pushActivity(kind: ActivityKind, text: string) {
  feed = [
    {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      text,
      at: Date.now(),
    },
    ...feed,
  ].slice(0, MAX);
  emit();
}

/* --------------------------------------------------------- onchain hydration */

let hydrated = false;

function labelFor(event: {
  event_name: string;
  wallet: string;
  args: Record<string, unknown> | null;
}): { kind: ActivityKind; text: string } | null {
  const who = `${event.wallet.slice(0, 6)}…${event.wallet.slice(-4)}`;
  const args = event.args ?? {};
  const amount = Number(args["amount"] ?? 0);
  switch (event.event_name) {
    case "PaymentReceived":
      return args["kind"] === "season-pass"
        ? { kind: "pass", text: `${who} purchased a Season Pass` }
        : {
            kind: "buy",
            text: `${who} paid ${amount.toLocaleString()} ${String(args["token"] ?? "FACTS")}`,
          };
    case "MatchCreated":
      return { kind: "house", text: `${who} opened a staked match` };
    case "MatchJoined":
      return { kind: "win", text: `${who} joined a staked match` };
    case "WinningsClaimed":
      return {
        kind: "claim",
        text: `${who} claimed ${amount.toLocaleString()} ${String(args["asset"] ?? "FACTS")}`,
      };
    case "RewardClaimed":
      return { kind: "claim", text: `${who} claimed FACTS rewards` };
    default:
      return null;
  }
}

/** Loads the real onchain feed once per session. No synthetic events. */
async function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const { listChainActivity } = await import("./chain.functions");
    const events = await listChainActivity();
    const mapped: ActivityEvent[] = [];
    for (const e of events) {
      const label = labelFor(e as never);
      if (!label) continue;
      mapped.push({
        id: `${e.tx_hash}-${mapped.length}`,
        kind: label.kind,
        text: label.text,
        at: new Date(e.created_at).getTime(),
      });
    }
    feed = [...mapped, ...feed].slice(0, MAX);
    emit();
  } catch (e) {
    console.error("Activity feed unavailable", e);
  }
}

/** Subscribe to the live ecosystem feed. */
export function useActivityFeed(): ActivityEvent[] {
  const [events, setEvents] = useState<ActivityEvent[]>(feed);

  useEffect(() => {
    void hydrate();
    setEvents(feed);
    const l = (f: ActivityEvent[]) => setEvents([...f]);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return events;
}
