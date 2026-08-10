/**
 * Deployed FarAction contracts on Base mainnet.
 *
 * Addresses and ABIs are the verified onchain deployments — the app talks to
 * these directly for payments, staked matches and reward claims.
 */
import { base } from "viem/chains";

export const CHAIN = base;
export const CHAIN_ID = base.id; // 8453

export const FACTS_ADDRESS = "0xb38760f61668ace43d8ee2e137d092841b23eb07" as const;
export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const TREASURY_ADDRESS = "0xd6b69e58d44e523eb58645f1b78425c96dfa648c" as const;

export const REWARD_DISTRIBUTOR_ADDRESS = "0xB2b1831Aea1E318a976751702d37CB9eB0860C3c" as const;
export const MATCH_VAULT_ADDRESS = "0x0a7701af00D818bF9F0c89f6971697f69638b142" as const;
export const PAYMENT_GATEWAY_ADDRESS = "0xbb5858B4465bc9169567a3246b215f0197867574" as const;

/**
 * Points-based daily $FACTS claim contract on Base. The backend signer
 * authorises each claim; the contract itself enforces the 24 hour cooldown and
 * converts Facts Points into $FACTS at its configured rate.
 */
export const FACTS_CLAIM_ADDRESS = "0x546186f2e8Efc407Cea08cAd33a55433fD531F8E" as const;
export const FACTS_CLAIM_SYMBOL = "FACTS" as const;

export const FACTS_CLAIM_ABI = [
  {
    type: "function",
    name: "backendSigner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "calculateReward",
    stateMutability: "view",
    inputs: [
      { name: "tokenSymbol", type: "string" },
      { name: "userPoints", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "canClaimToday",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "tokenSymbol", type: "string" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "claimReward",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenSymbol", type: "string" },
      { name: "userPoints", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getContractBalance",
    stateMutability: "view",
    inputs: [{ name: "tokenSymbol", type: "string" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getMessageHash",
    stateMutability: "pure",
    inputs: [
      { name: "user", type: "address" },
      { name: "tokenSymbol", type: "string" },
      { name: "userPoints", type: "uint256" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "getTimeUntilNextClaim",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "tokenSymbol", type: "string" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalClaimed",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "string" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "tokenSymbol", type: "string" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
] as const;

/** FACTS uses 18 decimals, USDC uses 6. */
export const FACTS_DECIMALS = 18;
export const USDC_DECIMALS = 6;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

export const REWARD_DISTRIBUTOR_ABI = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "campaignId", type: "uint256" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimMany",
    stateMutability: "nonpayable",
    inputs: [{ name: "campaignIds", type: "uint256[]" }],
    outputs: [{ name: "total", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimable",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimedOf",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "nextCampaignId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "campaigns",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "startsAt", type: "uint64" },
      { name: "endsAt", type: "uint64" },
      { name: "locked", type: "bool" },
      { name: "allocated", type: "uint256" },
      { name: "claimed", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      { indexed: true, name: "campaignId", type: "uint256" },
      { indexed: true, name: "account", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
] as const;

export const MATCH_VAULT_ABI = [
  {
    type: "function",
    name: "createMatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "asset", type: "uint8" },
      { name: "stake", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "settleMatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "joinMatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelMatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "asset", type: "uint8" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimable",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint8" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "matches",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "opponent", type: "address" },
      { name: "winner", type: "address" },
      { name: "asset", type: "uint8" },
      { name: "status", type: "uint8" },
      { name: "stake", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "MatchCreated",
    inputs: [
      { indexed: true, name: "matchId", type: "bytes32" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "asset", type: "uint8" },
      { indexed: false, name: "stake", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "MatchJoined",
    inputs: [
      { indexed: true, name: "matchId", type: "bytes32" },
      { indexed: true, name: "opponent", type: "address" },
    ],
  },
  {
    type: "event",
    name: "WinningsClaimed",
    inputs: [
      { indexed: true, name: "account", type: "address" },
      { indexed: false, name: "asset", type: "uint8" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
] as const;

export const PAYMENT_GATEWAY_ABI = [
  {
    type: "function",
    name: "pay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sku", type: "bytes32" },
      { name: "paymentRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "payFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sku", type: "bytes32" },
      { name: "beneficiary", type: "address" },
      { name: "paymentRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "payAmount",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sku", type: "bytes32" },
      { name: "beneficiary", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paymentRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "priceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "PaymentReceived",
    inputs: [
      { indexed: true, name: "sku", type: "bytes32" },
      { indexed: true, name: "payer", type: "address" },
      { indexed: true, name: "beneficiary", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "paymentRef", type: "bytes32" },
    ],
  },
] as const;

/** Vault asset enum: 0 = USDC, 1 = FACTS. */
export const ASSET = { USDC: 0, FACTS: 1 } as const;
export type VaultAsset = keyof typeof ASSET;

export function explorerTx(hash: string) {
  return `https://basescan.org/tx/${hash}`;
}
