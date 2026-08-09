import { createFileRoute } from "@tanstack/react-router";
import { PROD_ORIGIN } from "@/lib/config";
import { getSupabasePublishableKey } from "@/lib/runtime-env";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Diagnostics: fire a real Neynar notification and hand back Neynar's raw
 * status + body so a notification failure is visible instead of silently
 * swallowed. Guarded by the project's publishable key (same key the client
 * bundle already ships) purely to keep it off the open internet — this is a
 * debug tool, not a secret-bearing endpoint.
 *
 * POST /api/public/notify-test
 * headers: { apikey: <publishable key> }
 * body: { fid: number, title?: string, body?: string }
 */
export const Route = createFileRoute("/api/public/notify-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = getSupabasePublishableKey();
        const provided = request.headers.get("apikey");
        if (!expected || !provided || provided !== expected) {
          return json({ error: "Unauthorized" }, 401);
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        const fid = Number((payload as Record<string, unknown> | null)?.["fid"]);
        if (!Number.isFinite(fid) || fid <= 0) {
          return json({ error: "`fid` (positive integer) is required" }, 400);
        }
        const title = String((payload as Record<string, unknown>)["title"] ?? "FarAction test");
        const body = String(
          (payload as Record<string, unknown>)["body"] ?? "This is a diagnostic notification.",
        );

        const key = process.env["NEYNAR_SECRET_KEY"] ?? process.env["NEYNAR_API_KEY"];
        if (!key) {
          return json({ error: "NEYNAR_SECRET_KEY is not configured on the server" }, 500);
        }

        const neynarBody = {
          target_fids: [fid],
          notification: {
            title: title.slice(0, 32),
            body: body.slice(0, 128),
            target_url: PROD_ORIGIN,
            uuid: crypto.randomUUID(),
          },
        };

        try {
          const res = await fetch("https://api.neynar.com/v2/farcaster/frame/notifications/", {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              "x-api-key": key,
            },
            body: JSON.stringify(neynarBody),
          });
          const text = await res.text().catch(() => "<no body>");
          if (!res.ok) {
            console.error(`notify-test: Neynar failed [${res.status}]: ${text}`);
          }
          return json({
            ok: res.ok,
            status: res.status,
            request: neynarBody,
            response: (() => {
              try {
                return JSON.parse(text);
              } catch {
                return text;
              }
            })(),
          });
        } catch (e) {
          console.error("notify-test: Neynar request threw", e);
          return json({ ok: false, error: String(e) }, 502);
        }
      },
    },
  },
});
