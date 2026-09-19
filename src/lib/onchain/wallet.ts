/**
 * Wallet access for the FarAction mini app.
 *
 * Uses the Farcaster mini-app EIP-1193 provider when the app runs inside a
 * Farcaster client, and falls back to any injected browser wallet. Everything
 * is browser-only: no provider is touched during SSR.
 */
import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  fallback,
  http,
  type Address,
  type EIP1193Provider,
  type WalletClient,
} from "viem";
import { CHAIN, CHAIN_ID } from "./contracts";

/**
 * Reads go through a dedicated RPC first and only fall back to the public
 * endpoints, which are heavily rate limited (many mini app users share one
 * egress IP). Batching coalesces multi-call reads into a single request and a
 * slow polling interval keeps receipt polling well under the quota.
 */
const RPC_URLS = [
  import.meta.env["VITE_BASE_RPC_URL"] as string | undefined,
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  "https://base.llamarpc.com",
  "https://base.drpc.org",
  "https://1rpc.io/base",
].filter(Boolean) as string[];

/** Receipt polling interval (ms). viem's 4s default burns RPC quota fast. */
export const POLLING_INTERVAL = 12_000;

export const publicClient = createPublicClient({
  chain: CHAIN,
  pollingInterval: POLLING_INTERVAL,
  transport: fallback(
    RPC_URLS.map((url) => http(url, { batch: true, retryCount: 2, retryDelay: 800 })),
    { rank: false },
  ),
});

let cachedProvider: EIP1193Provider | null = null;

/** Never let a hanging provider call freeze the UI. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** Any EIP-1193 wallet injected by the browser (MetaMask, Base, Coinbase…). */
function injectedProvider(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: EIP1193Provider & { providers?: EIP1193Provider[] } })
    .ethereum;
  if (!eth) return null;
  // Multiple wallets installed: prefer one that announces Base/Coinbase/MetaMask.
  const list = eth.providers;
  if (Array.isArray(list) && list.length) {
    const flagged = list.find((p) => {
      const f = p as unknown as Record<string, boolean | undefined>;
      return f["isCoinbaseWallet"] || f["isBaseWallet"] || f["isMetaMask"];
    });
    return flagged ?? list[0] ?? null;
  }
  return eth;
}

type MiniAppSdk = {
  isInMiniApp?: () => Promise<boolean>;
  context?: Promise<unknown>;
  wallet?: {
    getEthereumProvider?: () => Promise<EIP1193Provider | undefined>;
    ethProvider?: EIP1193Provider;
  };
};

let sdkPromise: Promise<MiniAppSdk | null> | null = null;

async function loadMiniAppSdk(): Promise<MiniAppSdk | null> {
  if (typeof window === "undefined") return null;
  sdkPromise ??= (async () => {
    try {
      const url = "https://esm.sh/@farcaster/miniapp-sdk@0.3.0";
      const mod = (await withTimeout(
        import(/* @vite-ignore */ url),
        6_000,
        "Farcaster SDK load timed out",
      )) as { sdk?: MiniAppSdk };
      return mod.sdk ?? null;
    } catch {
      return null;
    }
  })();
  return sdkPromise;
}

/**
 * Real mini-app detection. The old heuristic ("are we in an iframe?") was true
 * for any embed — including a normal browser preview — so the Farcaster wallet
 * was asked for accounts with no Farcaster host to answer, and Connect hung.
 */
async function isMiniApp(): Promise<boolean> {
  const sdk = await loadMiniAppSdk();
  if (!sdk) return false;
  try {
    if (typeof sdk.isInMiniApp === "function") {
      return await withTimeout(sdk.isInMiniApp(), 2_500, "mini app check timed out");
    }
    const ctx = await withTimeout(
      Promise.resolve(sdk.context),
      2_500,
      "mini app check timed out",
    );
    return Boolean(ctx);
  } catch {
    return false;
  }
}

async function farcasterProvider(): Promise<EIP1193Provider | null> {
  try {
    const sdk = await loadMiniAppSdk();
    if (!sdk?.wallet) return null;
    const provider = sdk.wallet.getEthereumProvider
      ? await withTimeout(
          sdk.wallet.getEthereumProvider(),
          5_000,
          "Farcaster wallet did not respond",
        )
      : undefined;
    return provider ?? sdk.wallet.ethProvider ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves a wallet provider. Inside a real Farcaster client the mini-app
 * wallet wins so that flow is untouched; everywhere else we use the browser's
 * injected wallet (MetaMask, Base/Coinbase Wallet, Rabby, …).
 */
async function loadProvider(): Promise<EIP1193Provider | null> {
  if (typeof window === "undefined") return null;
  if (cachedProvider) return cachedProvider;

  const injected = injectedProvider();

  if (await isMiniApp()) {
    const fc = await farcasterProvider();
    if (fc) {
      cachedProvider = fc;
      return fc;
    }
  }

  if (injected) {
    cachedProvider = injected;
    return injected;
  }

  const fc = await farcasterProvider();
  if (fc) cachedProvider = fc;
  return cachedProvider;
}

export async function getWalletClient(): Promise<{
  client: WalletClient;
  account: Address;
}> {
  const provider = await loadProvider();
  if (!provider) {
    throw new Error(
      "No wallet found. Install MetaMask or Base/Coinbase Wallet, or open FarAction inside Farcaster.",
    );
  }
  const accounts = (await withTimeout(
    provider.request({ method: "eth_requestAccounts" }) as Promise<Address[]>,
    120_000,
    "Your wallet did not respond. Open the wallet app or extension and approve the connection, then try again.",
  )) as Address[];
  const account = accounts[0];
  if (!account) throw new Error("Wallet connection rejected.");

  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (parseInt(chainId, 16) !== CHAIN_ID) {
    const hexChain = `0x${CHAIN_ID.toString(16)}`;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChain }],
      });
    } catch (error) {
      // Wallet doesn't know Base yet → offer to add it, then retry.
      const code = (error as { code?: number } | null)?.code;
      if (code === 4902 || code === -32603) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hexChain,
                chainName: "Base",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"],
              },
            ],
          });
        } catch {
          throw new Error("Switch your wallet to the Base network to continue.");
        }
      } else {
        throw new Error("Switch your wallet to the Base network to continue.");
      }
    }
  }

  return {
    client: createWalletClient({ account, chain: CHAIN, transport: custom(provider) }),
    account,
  };
}

const STORAGE_KEY = "faraction:wallet";
const listeners = new Set<(a: Address | null) => void>();
let currentAddress: Address | null = null;

function broadcast(address: Address | null) {
  currentAddress = address;
  if (typeof window !== "undefined") {
    if (address) window.localStorage.setItem(STORAGE_KEY, address);
    else window.localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((l) => l(address));
}

/** Mirrors wallet-side account switches / disconnects into app state. */
let accountWatcherBound = false;
function watchAccounts(provider: EIP1193Provider) {
  if (accountWatcherBound) return;
  accountWatcherBound = true;
  const on = (provider as unknown as { on?: (e: string, cb: (a: string[]) => void) => void }).on;
  on?.call(provider, "accountsChanged", (accounts: string[]) => {
    broadcast((accounts[0] as Address | undefined) ?? null);
  });
}

export function useWallet() {
  const [address, setAddress] = useState<Address | null>(currentAddress);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Address | null;
    if (stored && !currentAddress) currentAddress = stored;
    setAddress(currentAddress);
    const l = (a: Address | null) => setAddress(a);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const { account } = await getWalletClient();
      if (cachedProvider) watchAccounts(cachedProvider);
      broadcast(account);
      return account;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Wallet connection failed";
      setError(message);
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // Drop the cached provider so the next connect re-prompts the wallet.
    cachedProvider = null;
    accountWatcherBound = false;
    setError(null);
    broadcast(null);
  }, []);

  return { address, connect, disconnect, connecting, error };
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
