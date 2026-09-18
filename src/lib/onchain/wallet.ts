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
  "https://base.llamarpc.com",
  "https://mainnet.base.org",
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

/** True when running inside a Farcaster client (mini app iframe/webview). */
function inFarcasterFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.parent !== window || Boolean((window as { ReactNativeWebView?: unknown }).ReactNativeWebView);
  } catch {
    return true;
  }
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

async function farcasterProvider(): Promise<EIP1193Provider | null> {
  try {
    const url = "https://esm.sh/@farcaster/miniapp-sdk@0.3.0";
    const mod = (await import(/* @vite-ignore */ url)) as {
      sdk?: {
        wallet?: {
          getEthereumProvider?: () => Promise<EIP1193Provider | undefined>;
          ethProvider?: EIP1193Provider;
        };
      };
    };
    return (await mod.sdk?.wallet?.getEthereumProvider?.()) ?? mod.sdk?.wallet?.ethProvider ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves a wallet provider. Inside Farcaster the mini-app wallet wins so the
 * existing mini app flow is untouched; in a plain browser we fall back to any
 * injected wallet (MetaMask, Base/Coinbase Wallet, Rabby, …).
 */
async function loadProvider(): Promise<EIP1193Provider | null> {
  if (typeof window === "undefined") return null;
  if (cachedProvider) return cachedProvider;

  if (inFarcasterFrame()) {
    const fc = await farcasterProvider();
    if (fc) {
      cachedProvider = fc;
      return fc;
    }
  }

  const injected = injectedProvider();
  if (injected) {
    cachedProvider = injected;
    return injected;
  }

  // Last resort: a Farcaster client that didn't look like a frame.
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
    throw new Error("Open FarAction inside Farcaster to use the connected wallet.");
  }
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
  const account = accounts[0];
  if (!account) throw new Error("Wallet connection rejected.");

  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (parseInt(chainId, 16) !== CHAIN_ID) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
      });
    } catch {
      throw new Error("Switch your wallet to the Base network to continue.");
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

  const disconnect = useCallback(() => broadcast(null), []);

  return { address, connect, disconnect, connecting, error };
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
