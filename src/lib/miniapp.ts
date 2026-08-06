/**
 * Farcaster Mini App host actions (swap, add mini app, notifications).
 *
 * The SDK is loaded from a CDN at runtime so it never enters the server
 * bundle, and every action degrades to a plain web fallback outside a
 * Farcaster client.
 */

const SDK_URL = "https://esm.sh/@farcaster/miniapp-sdk@0.3.0";

interface MiniAppSdk {
  context: Promise<{
    client?: { added?: boolean; notificationDetails?: { token: string; url: string } };
    user?: { fid?: number };
  }>;
  actions: {
    ready: () => Promise<void>;
    composeCast?: (args: { text: string; embeds?: [] | [string] }) => Promise<unknown>;
    swapToken?: (args: {
      buyToken: string;
      sellToken?: string;
      sellAmount?: string;
    }) => Promise<unknown>;
    addMiniApp?: () => Promise<unknown>;
    addFrame?: () => Promise<unknown>;
  };
}

let sdkPromise: Promise<MiniAppSdk | null> | null = null;

export async function loadSdk(): Promise<MiniAppSdk | null> {
  if (typeof window === "undefined") return null;
  sdkPromise ??= (async () => {
    try {
      const mod = (await import(/* @vite-ignore */ SDK_URL)) as { sdk?: MiniAppSdk };
      return mod.sdk ?? null;
    } catch {
      return null;
    }
  })();
  return sdkPromise;
}

/** True when a Farcaster host client is present. */
export async function isInMiniApp(): Promise<boolean> {
  const sdk = await loadSdk();
  if (!sdk) return false;
  try {
    const ctx = await sdk.context;
    return Boolean(ctx);
  } catch {
    return false;
  }
}

/** CAIP-19 id for an ERC-20 on Base mainnet. */
export function baseToken(address: string): string {
  return `eip155:8453/erc20:${address}`;
}

/** Native ETH on Base — always sent so hosts never default to another chain. */
export const BASE_NATIVE = "eip155:8453/native";

/**
 * Hand the token to the host client and let Farcaster run the entire swap
 * (quote, approval, chain switch, confirmation) in its native drawer. We never
 * build the transaction or touch an RPC ourselves.
 */
export async function swapToken(args: {
  buyToken: string;
  sellToken?: string;
  sellAmount?: string;
}): Promise<void> {
  const sdk = await loadSdk();
  if (sdk?.actions?.swapToken) {
    await sdk.actions.swapToken({
      buyToken: args.buyToken,
      sellToken: args.sellToken ?? BASE_NATIVE,
      ...(args.sellAmount ? { sellAmount: args.sellAmount } : {}),
    });
    return;
  }
  if (typeof window !== "undefined") {
    window.open(
      `https://farcaster.xyz/~/swap?token=${encodeURIComponent(args.buyToken)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
}

let cachedAdded: boolean | null = null;

/** Prompt the native "add mini app" sheet, skipping users who already added it. */
export async function addMiniApp(): Promise<boolean> {
  const sdk = await loadSdk();
  if (!sdk) return false;
  
  // Re-check the context in case it changed since the last call.
  try {
    const ctx = await sdk.context;
    if (ctx?.client?.added) {
      cachedAdded = true;
      return true;
    }
  } catch {
    // Ignore error
  }

  const action = sdk.actions.addMiniApp ?? sdk.actions.addFrame;
  if (!action) return false;
  try {
    await action();
    cachedAdded = true;
    return true;
  } catch {
    return false;
  }
}

/** Returns true if the app is already added and notifications are enabled. */
export async function notificationsEnabled(): Promise<boolean> {
  const sdk = await loadSdk();
  if (!sdk) return false;
  try {
    const ctx = await sdk.context;
    return Boolean(ctx?.client?.notificationDetails);
  } catch {
    return false;
  }
}
