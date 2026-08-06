import { createFileRoute } from "@tanstack/react-router";

/**
 * Farcaster Mini App webhook.
 *
 * Receives `miniapp_added`, `miniapp_removed`, `notifications_enabled` and
 * `notifications_disabled` events. Every payload is a JSON Farcaster Signature
 * envelope, verified against the signer's registered app key through the Neynar
 * hub before anything is stored.
 *
 * Registered in /.well-known/farcaster.json as `webhookUrl`.
 */
export const Route = createFileRoute("/api/public/webhook/neynar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["NEYNAR_SECRET_KEY"] ?? process.env["NEYNAR_API_KEY"];
        if (!apiKey) {
          console.error("Neynar webhook: NEYNAR_SECRET_KEY is not configured");
          return json({ error: "Webhook not configured" }, 500);
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const { parseMiniAppWebhook } = await import("@/lib/farcaster-webhook.server");

        let fid: number;
        let event: Awaited<ReturnType<typeof parseMiniAppWebhook>>["event"];
        try {
          const result = await parseMiniAppWebhook(raw, apiKey);
          fid = result.fid;
          event = result.event;
        } catch (e) {
          console.error("Neynar webhook verification failed", e);
          return json({ error: "Invalid webhook signature" }, 401);
        }
        const { saveNotificationToken, disableNotificationTokens, sendMiniAppNotification } =
          await import("@/lib/notifications.server");
        const { PROD_ORIGIN } = await import("@/lib/config");

        try {
          switch (event.event) {
            case "miniapp_added": {
              const details = "notificationDetails" in event ? event.notificationDetails : null;
              if (details) {
                await saveNotificationToken({
                  fid,
                  token: details.token,
                  url: details.url,
                  event: event.event,
                });
                await sendMiniAppNotification({
                  fids: [fid],
                  title: "Welcome to FarAction",
                  body: "Your squad is ready. Claim your daily FACTS and enter the arena.",
                  targetUrl: PROD_ORIGIN,
                  notificationId: `welcome-${fid}`,
                }).catch((e) => console.error("Welcome notification failed", e));
              }
              break;
            }
            case "notifications_enabled": {
              await saveNotificationToken({
                fid,
                token: event.notificationDetails.token,
                url: event.notificationDetails.url,
                event: event.event,
              });
              break;
            }
            case "miniapp_removed":
            case "notifications_disabled": {
              await disableNotificationTokens(fid, event.event);
              break;
            }
            default:
              console.warn("Neynar webhook: unhandled event", event);
          }
        } catch (e) {
          console.error("Neynar webhook processing error", e);
          return json({ error: "Could not process the event" }, 500);
        }

        return json({ ok: true, fid, event: event.event });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
