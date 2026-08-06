import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, UserPlus, Loader2, BadgeCheck } from "lucide-react";
import { searchUsers } from "@/lib/neynar.functions";
import type { FarcasterUser } from "@/lib/neynar.server";
import { sfx } from "@/lib/sound";

/**
 * Farcaster + FarAction player search. Pick an opponent and challenge them
 * without leaving the match maker.
 */
export function FarcasterSearch({
  selected,
  onSelect,
}: {
  selected: FarcasterUser | null;
  onSelect: (u: FarcasterUser | null) => void;
}) {
  const [q, setQ] = useState("");
  const run = useServerFn(searchUsers);
  const search = useMutation({ mutationFn: (query: string) => run({ data: { query } }) });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 1) return;
    sfx.tap();
    search.mutate(q.trim());
  };

  return (
    <div className="space-y-2">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Farcaster users or FarAction players"
            className="w-full rounded-lg border border-border/70 bg-card/50 py-2.5 pr-3 pl-9 text-xs"
          />
        </div>
        <button type="submit" className="fa-btn-ghost shrink-0">
          {search.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Search
        </button>
      </form>

      {selected ? (
        <div className="flex items-center gap-3 rounded-lg border border-accent/60 bg-accent/10 p-2.5">
          <Avatar user={selected} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-xs font-bold">
              {selected.displayName}
            </span>
            <span className="label-xs">@{selected.username}</span>
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="label-xs hover:text-strike"
          >
            Change
          </button>
        </div>
      ) : null}

      {search.data?.error ? <p className="text-[11px] text-strike">{search.data.error}</p> : null}

      {!selected && search.data?.users?.length ? (
        <ul className="fa-scroll max-h-44 space-y-1 overflow-y-auto pr-1">
          {search.data.users.map((u) => (
            <li key={u.fid}>
              <button
                type="button"
                onClick={() => {
                  sfx.select();
                  onSelect(u);
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-2.5 text-left transition-colors hover:border-accent/70"
              >
                <Avatar user={u} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate font-display text-xs font-bold">
                    {u.displayName}
                    {u.isPlayer ? <BadgeCheck className="size-3.5 shrink-0 text-facts" /> : null}
                  </span>
                  <span className="label-xs">
                    @{u.username}
                    {u.isPlayer ? " · FarAction player" : ""}
                  </span>
                </span>
                <UserPlus className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!selected && search.isSuccess && search.data.users.length === 0 && !search.data.error ? (
        <p className="text-[11px] text-muted-foreground">No users matched “{q}”.</p>
      ) : null}
    </div>
  );
}

function Avatar({ user }: { user: FarcasterUser }) {
  if (user.pfpUrl) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={user.pfpUrl}
        alt=""
        className="size-8 shrink-0 rounded-full border border-border/60 object-cover"
      />
    );
  }
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border/60 bg-card font-display text-[11px]">
      {user.username.slice(0, 2).toUpperCase()}
    </span>
  );
}
