import { createFileRoute } from "@tanstack/react-router";
import { resolveResultCard, type SharePreviewContext } from "@/lib/share-meta";

let fontPromise: Promise<ArrayBuffer> | null = null;
/** A single variable TTF (satori needs real font bytes, not woff2). Fetched
 * once per Worker instance and reused for every request after that. */
function loadFont(): Promise<ArrayBuffer> {
  fontPromise ??= fetch(
    "https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-Bold.ttf",
  ).then((r) => {
    if (!r.ok) throw new Error(`font fetch failed [${r.status}]`);
    return r.arrayBuffer();
  });
  return fontPromise;
}

let resvgReady: Promise<void> | null = null;
/**
 * The renderer binary is served as a static asset and fetched at runtime — it
 * must never be imported from source, or it ends up inside the server bundle.
 */
async function ensureResvg(origin: string) {
  resvgReady ??= (async () => {
    const { initWasm } = await import("@resvg/resvg-wasm");
    const res = await fetch(new URL("/wasm/resvg.wasm", origin));
    if (!res.ok) throw new Error(`resvg wasm fetch failed [${res.status}]`);
    await initWasm(await res.arrayBuffer());
  })();
  return resvgReady;
}

function card(context: SharePreviewContext) {
  if (context.kind === "result") {
    const data = resolveResultCard(context);
    const won = data.wordmark === "WIN";
    return {
      type: "div",
      props: {
        style: {
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: won
            ? "linear-gradient(135deg,#0a2b1f,#0a0f16 60%)"
            : "linear-gradient(135deg,#2b0a0f,#0a0f16 60%)",
          fontFamily: "Inter",
          color: "#f7fbff",
        },
        children: [
          {
            type: "div",
            props: {
              style: { fontSize: 28, letterSpacing: 6, color: "#7af7d3", marginBottom: 12 },
              children: "FARACTION",
            },
          },
          {
            type: "div",
            props: {
              style: {
                fontSize: 140,
                fontWeight: 800,
                color: won ? "#7af7d3" : "#ff6b7a",
                marginBottom: 24,
              },
              children: data.wordmark,
            },
          },
          {
            type: "div",
            props: {
              style: { display: "flex", fontSize: 44, fontWeight: 700, marginBottom: 24 },
              children: `@${data.winner}  ⚔️  @${data.loser}`,
            },
          },
          {
            type: "div",
            props: {
              style: { display: "flex", fontSize: 26, color: "#7ab2ff" },
              children: [
                data.mode,
                data.fighter ? ` · ${data.fighter}` : "",
                data.oppFighter ? ` vs ${data.oppFighter}` : "",
                data.rewardLabel ? ` · ${data.rewardLabel}` : "",
              ]
                .filter(Boolean)
                .join(""),
            },
          },
        ],
      },
    };
  }

  const host = (context.hostHandle ?? "alice").replace(/^@/, "");
  const opponent = (context.opponentHandle ?? "bob").replace(/^@/, "");
  const kicker = context.season ?? "Genesis: The Awakening";
  const mode = context.mode ?? "1v1";
  return {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg,#121b29,#0a0f16 70%)",
        fontFamily: "Inter",
        color: "#f7fbff",
      },
      children: [
        {
          type: "div",
          props: {
            style: { fontSize: 28, letterSpacing: 6, color: "#7af7d3", marginBottom: 20 },
            children: "FARACTION",
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", fontSize: 64, fontWeight: 800, marginBottom: 20 },
            children: context.title ?? `@${host}  vs  @${opponent}`,
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", fontSize: 30, color: "#7ab2ff" },
            children: `${mode} · ${kicker}`,
          },
        },
      ],
    },
  };
}

export const Route = createFileRoute("/api/share/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const params = url.searchParams;
        const kindParam = params.get("kind");
        const context: SharePreviewContext = {
          ...(kindParam === "challenge" ||
          kindParam === "result" ||
          kindParam === "reward" ||
          kindParam === "leaderboard" ||
          kindParam === "match"
            ? { kind: kindParam }
            : { kind: "match" }),
          ...(params.get("matchId") ? { matchId: params.get("matchId")! } : {}),
          ...(params.get("hostHandle") ? { hostHandle: params.get("hostHandle")! } : {}),
          ...(params.get("opponentHandle") ? { opponentHandle: params.get("opponentHandle")! } : {}),
          ...(params.get("winnerHandle") ? { winnerHandle: params.get("winnerHandle")! } : {}),
          ...(params.get("loserHandle") ? { loserHandle: params.get("loserHandle")! } : {}),
          ...(params.get("mode") ? { mode: params.get("mode")! } : {}),
          ...(params.get("token") ? { token: params.get("token")! } : {}),
          ...(params.get("reward") ? { reward: params.get("reward")! } : {}),
          ...(params.get("season") ? { season: params.get("season")! } : {}),
          ...(params.get("title") ? { title: params.get("title")! } : {}),
          ...(params.get("description") ? { description: params.get("description")! } : {}),
          ...(params.has("won") ? { won: params.get("won") === "1" } : {}),
          ...(params.get("fighter") ? { fighter: params.get("fighter")! } : {}),
          ...(params.get("oppFighter") ? { oppFighter: params.get("oppFighter")! } : {}),
        };

        try {
          const [{ default: satori }, fontData] = await Promise.all([
            import("satori"),
            loadFont(),
          ]);
          const svg = await satori(card(context) as never, {
            width: 1200,
            height: 630,
            fonts: [
              { name: "Inter", data: fontData, weight: 400, style: "normal" },
              { name: "Inter", data: fontData, weight: 800, style: "normal" },
            ],
          });

          await ensureResvg(url.origin);
          const { Resvg } = await import("@resvg/resvg-wasm");
          const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();

          return new Response(png.buffer as ArrayBuffer, {
            headers: {
              "content-type": "image/png",
              "cache-control": "public, max-age=300, s-maxage=300",
            },
          });
        } catch (e) {
          console.error("share/og: PNG render failed", e);
          // Fall back to the vector card so crawlers still get a real, on-brand
          // preview instead of a blank pixel.
          const { buildShareCardSvg } = await import("@/lib/share-meta");
          return new Response(buildShareCardSvg(context), {
            status: 200,
            headers: {
              "content-type": "image/svg+xml; charset=utf-8",
              "cache-control": "public, max-age=300, s-maxage=300",
            },
          });
        }
      },
    },
  },
});
