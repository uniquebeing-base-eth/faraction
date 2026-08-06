/**
 * Runtime environment resolution that survives the Cloudflare Worker build.
 *
 * Vite only inlines *statically referenced* `import.meta.env.X` expressions.
 * Spreading `import.meta.env` (or reading it with a computed key) leaves the
 * Worker bundle with an empty object, which is why `VITE_SUPABASE_URL` and
 * friends disappeared in production. The STATIC_ENV block below forces the
 * inlining, and `getRuntimeEnv()` merges the sources so the same code resolves
 * in Lovable (process.env), in Workers (globals) and in the browser.
 */

const STATIC_ENV: Record<string, string | undefined> = {
  VITE_SUPABASE_URL: import.meta.env["VITE_SUPABASE_URL"],
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
  VITE_SUPABASE_ANON_KEY: import.meta.env["VITE_SUPABASE_ANON_KEY"],
  VITE_SUPABASE_PROJECT_ID: import.meta.env["VITE_SUPABASE_PROJECT_ID"],
};

function processEnv(): Record<string, string | undefined> {
  try {
    return typeof process !== "undefined" && process.env ? process.env : {};
  } catch {
    return {};
  }
}

function globalEnv(): Record<string, string | undefined> {
  const g = globalThis as unknown as { __env?: Record<string, string | undefined> };
  return g.__env ?? {};
}

export function getRuntimeEnv(): Record<string, string | undefined> {
  return { ...STATIC_ENV, ...globalEnv(), ...processEnv() };
}

/** Reads the first defined value across every accepted key alias. */
export function readEnv(...keys: string[]): string | undefined {
  const env = getRuntimeEnv();
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

export function getSupabaseUrl(): string | undefined {
  return readEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
}

export function getSupabasePublishableKey(): string | undefined {
  return readEnv(
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
  );
}
