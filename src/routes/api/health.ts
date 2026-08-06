import { createFileRoute } from "@tanstack/react-router";
import { getSupabasePublishableKey, getSupabaseUrl, readEnv } from "@/lib/runtime-env";

/**
 * Deployment probe. Hit this on the live URL to confirm the publishable
 * backend config survived the build. `hasServiceRoleKey` is intentionally
 * false — no privileged key exists in the request path.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const body = {
          ok: Boolean(getSupabaseUrl() && getSupabasePublishableKey()),
          hasSupabaseUrl: Boolean(getSupabaseUrl()),
          hasPublishableKey: Boolean(getSupabasePublishableKey()),
          hasServiceRoleKey: false,
          hasNeynarKey: Boolean(readEnv("NEYNAR_SECRET_KEY", "NEYNAR_API_KEY")),
          time: new Date().toISOString(),
        };
        return new Response(JSON.stringify(body, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
