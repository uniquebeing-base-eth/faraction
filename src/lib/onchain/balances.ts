/**
 * Live token balances for the connected wallet.
 *
 * Nothing is simulated: USDC and FACTS are read straight from their Base
 * contracts with `balanceOf` for the connected address.
 */
import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { publicClient } from "./wallet";
import {
  ERC20_ABI,
  FACTS_ADDRESS,
  FACTS_DECIMALS,
  USDC_ADDRESS,
  USDC_DECIMALS,
} from "./contracts";
import { useWallet } from "./wallet";

export interface TokenBalances {
  usdc: number;
  facts: number;
}

export async function readTokenBalances(address: Address): Promise<TokenBalances> {
  const [usdc, facts] = await Promise.all([
    publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    }),
    publicClient.readContract({
      address: FACTS_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);
  return {
    usdc: Number(formatUnits(usdc, USDC_DECIMALS)),
    facts: Number(formatUnits(facts, FACTS_DECIMALS)),
  };
}

/**
 * Wallet balances for the UI. Returns zeros while disconnected — never a
 * placeholder figure.
 */
export function useTokenBalances() {
  const { address, connect, connecting } = useWallet();

  const query = useQuery({
    queryKey: ["token-balances", address],
    enabled: Boolean(address),
    refetchInterval: 30_000,
    queryFn: () => readTokenBalances(address!),
  });

  return {
    address,
    connect,
    connecting,
    connected: Boolean(address),
    usdc: query.data?.usdc ?? 0,
    facts: query.data?.facts ?? 0,
    isLoading: Boolean(address) && query.isLoading,
    refetch: query.refetch,
  };
}
