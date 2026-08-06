/**
 * Server-side Supabase client that uses ONLY the publishable key.
 *
 * There is deliberately no service-role client anywhere in the request path.
 * Every privileged write goes through a `SECURITY DEFINER` database routine,
 * so the publishable key is enough and no master key can leak or go missing on
 * Cloudflare.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getSupabasePublishableKey, getSupabaseUrl } from "./runtime-env";

function isOpaqueKey(value: string) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/**
 * New-format keys are opaque strings, not JWTs. PostgREST rejects them as a
 * bearer token ("Expected 3 parts in JWT; got 1"), so we send `apikey` only.
 */
function publishableFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    }
    if (isOpaqueKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

let cached: SupabaseClient<Database> | undefined;

export function getSupabasePublic(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    const missing = [...(!url ? ["SUPABASE_URL"] : []), ...(!key ? ["SUPABASE_PUBLISHABLE_KEY"] : [])];
    throw new Error(`Missing backend configuration: ${missing.join(", ")}`);
  }

  cached = createClient<Database>(url, key, {
    global: { fetch: publishableFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function hasSupabaseConfig() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}
