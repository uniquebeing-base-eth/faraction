import { useEffect } from "react";

/**
 * Signals to the Farcaster client that the app has painted, which dismisses
 * the splash screen. Loaded dynamically so the SDK never runs during SSR.
 */
export function MiniAppReady() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Loaded from CDN at runtime: the npm SDK drags Solana deps that cannot
        // be bundled for the edge server runtime. The URL is a variable so the
        // bundler leaves it alone and it only ever runs in the browser.
        const url = "https://esm.sh/@farcaster/miniapp-sdk@0.3.0";
        const { sdk } = (await import(/* @vite-ignore */ url)) as {
          sdk: { actions: { ready: () => Promise<void> } };
        };
        if (cancelled) return;
        await sdk.actions.ready();
      } catch {
        // Not running inside a Farcaster client — plain web is fine.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
