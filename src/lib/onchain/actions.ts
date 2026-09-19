/**
 * Onchain actions: approvals, gateway payments, staked matches and claims.
 * Every write returns the tx hash and mirrors the result into the database.
 */
import { keccak256, parseUnits, stringToHex, toHex, type Address } from "viem";
import {
  ASSET,
  ERC20_ABI,
  FACTS_ADDRESS,
  FACTS_DECIMALS,
  MATCH_VAULT_ABI,
  MATCH_VAULT_ADDRESS,
  PAYMENT_GATEWAY_ABI,
  PAYMENT_GATEWAY_ADDRESS,
  REWARD_DISTRIBUTOR_ABI,
  REWARD_DISTRIBUTOR_ADDRESS,
  TREASURY_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  type VaultAsset,
} from "./contracts";
import { getWalletClient, publicClient, POLLING_INTERVAL } from "./wallet";
import { recordChainEvent } from "@/lib/chain.functions";

/** keccak256 of a plain label — used for SKUs and match ids (bytes32). */
/** Minimal transfer ABI (the shared ERC20_ABI is read/approve only). */
const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export function toBytes32(label: string) {
  return keccak256(stringToHex(label));
}

/**
 * Wait for a receipt without ever turning a polling failure into a payment
 * failure.
 *
 * Once `writeContract` returns a hash the transaction is already live on Base:
 * it was broadcast through the wallet's own provider, not through our RPC.
 * Receipt polling *does* run against our RPC transport, and that is the part
 * that gets rate limited (`over rate limit`) or times out. Treating that as
 * "the payment failed" is what made successful transfers show a red error.
 *
 * A receipt that says `reverted` is a real failure and throws. Anything else —
 * rate limit, timeout, node hiccup — resolves as `{ confirmed: false }`, and
 * the caller hands the hash to the server, which verifies it with its own RPC.
 */
export async function waitForReceiptSoft(
  hash: `0x${string}`,
  label = "transaction",
): Promise<{ confirmed: boolean }> {
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      pollingInterval: POLLING_INTERVAL,
      retryCount: 10,
      retryDelay: 2_000,
      confirmations: 1,
      timeout: 120_000,
    });
    if (receipt.status !== "success") throw new Error(`The ${label} reverted on Base.`);
    return { confirmed: true };
  } catch (error) {
    // A revert we raised ourselves must still surface as a real failure.
    if (error instanceof Error && error.message.includes("reverted on Base")) throw error;
    console.warn(`Receipt polling failed for ${hash}; verifying server-side instead.`, error);
    return { confirmed: false };
  }
}


export function tokenAddress(asset: VaultAsset): Address {
  return asset === "FACTS" ? FACTS_ADDRESS : USDC_ADDRESS;
}

export function decimalsFor(asset: VaultAsset) {
  return asset === "FACTS" ? FACTS_DECIMALS : USDC_DECIMALS;
}

/** Live decimals straight from the token contract (falls back to the constant). */
async function tokenDecimals(token: Address, fallback: number) {
  try {
    return Number(
      (await publicClient.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "decimals",
      })) as number,
    );
  } catch {
    return fallback;
  }
}

/** Throws a readable error when the wallet cannot cover `amount`. */
async function assertBalance(token: Address, owner: Address, amount: bigint, label: string) {
  const balance = (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [owner],
  })) as bigint;
  if (balance < amount) {
    const decimals = token === FACTS_ADDRESS ? FACTS_DECIMALS : USDC_DECIMALS;
    const need = Number(amount) / 10 ** decimals;
    const have = Number(balance) / 10 ** decimals;
    throw new Error(
      `Not enough ${label} on Base — ${need.toLocaleString()} needed, you hold ${have.toLocaleString()}.`,
    );
  }
}

/**
 * Approve `spender` for `amount` when the current allowance is too low.
 * Never assumes an approval exists, simulates before sending, and handles
 * tokens that require the allowance to be reset to zero first.
 */
async function ensureAllowance(token: Address, spender: Address, amount: bigint, owner: Address) {
  const allowance = (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;
  if (allowance >= amount) return;

  const { client } = await getWalletClient();

  // No simulation here: a flaky public RPC answers with "Unknown provider RPC
  // error", which viem reports as an `approve` revert and kills a perfectly
  // valid purchase. The wallet does its own estimation, and the allowance
  // re-read below is the real check.
  const approve = async (value: bigint) => {
    const hash = await client.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, value],
      account: owner,
      chain: client.chain,
    });
    // Soft wait: a rate-limited poll is not a failed approval.
    await waitForReceiptSoft(hash, "approval transaction");
  };

  try {
    await approve(amount);
  } catch (error) {
    // Some ERC-20s reject a non-zero → non-zero allowance change.
    if (allowance > 0n) {
      await approve(0n);
      await approve(amount);
    } else {
      throw error;
    }
  }

  const updated = (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;
  if (updated < amount) throw new Error("The token approval did not go through — try again.");
}

/** Simulate, send and confirm a contract write; surfaces revert reasons early. */
async function sendWrite(params: {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
  account: Address;
  /** Skip the receipt poll: the hash is enough, the server verifies it. */
  wait?: boolean;
}) {
  const { client } = await getWalletClient();
  const { request } = await publicClient.simulateContract({
    address: params.address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    abi: params.abi as any,
    functionName: params.functionName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: params.args as any,
    account: params.account,
  });
  const hash = await client.writeContract({ ...request, chain: client.chain });
  if (params.wait !== false) await waitForReceiptSoft(hash);
  return hash;
}

export async function readFactsBalance(address: Address) {
  return (await publicClient.readContract({
    address: FACTS_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;
}

export async function readUsdcBalance(address: Address) {
  return (await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;
}

/** Listed price of a SKU on the gateway (0 when unlisted). */
export async function readSkuPrice(sku: string) {
  return (await publicClient.readContract({
    address: PAYMENT_GATEWAY_ADDRESS,
    abi: PAYMENT_GATEWAY_ABI,
    functionName: "priceOf",
    args: [toBytes32(sku)],
  })) as bigint;
}

/**
 * Pay for a store item / season pass in FACTS through the payment gateway.
 *
 * Full ERC-20 flow: verify decimals, check the balance, check the allowance,
 * approve when short, simulate, then send and wait for the receipt.
 */
export async function payWithFacts(options: {
  sku: string;
  kind: "season-pass" | "store" | "entry-fee";
  amountFacts: number;
  usdValue?: number;
  beneficiary?: Address;
}) {
  const { account } = await getWalletClient();
  const skuHash = toBytes32(options.sku);
  const decimals = await tokenDecimals(FACTS_ADDRESS, FACTS_DECIMALS);

  const listed = (await publicClient.readContract({
    address: PAYMENT_GATEWAY_ADDRESS,
    abi: PAYMENT_GATEWAY_ABI,
    functionName: "priceOf",
    args: [skuHash],
  })) as bigint;

  const quoted = Number.isFinite(options.amountFacts) ? options.amountFacts : 0;
  const amount = listed > 0n ? listed : parseUnits(quoted.toFixed(Math.min(decimals, 8)), decimals);
  if (amount <= 0n) throw new Error("The FACTS price is still loading — try again in a moment.");

  const beneficiary = options.beneficiary ?? account;
  const paymentRef = toHex(crypto.randomUUID().replace(/-/g, ""), { size: 32 });

  await assertBalance(FACTS_ADDRESS, account, amount, "FACTS");
  await ensureAllowance(FACTS_ADDRESS, PAYMENT_GATEWAY_ADDRESS, amount, account);

  const hash =
    listed > 0n
      ? await sendWrite({
          wait: false,
          address: PAYMENT_GATEWAY_ADDRESS,
          abi: PAYMENT_GATEWAY_ABI,
          functionName: "payFor",
          args: [skuHash, beneficiary, paymentRef],
          account,
        })
      : await sendWrite({
          wait: false,
          address: PAYMENT_GATEWAY_ADDRESS,
          abi: PAYMENT_GATEWAY_ABI,
          functionName: "payAmount",
          args: [skuHash, beneficiary, amount, paymentRef],
          account,
        });

  await recordChainEvent({
    data: {
      contract: "FactsPaymentGateway",
      eventName: "PaymentReceived",
      txHash: hash,
      wallet: account,
      args: {
        sku: options.sku,
        kind: options.kind,
        paymentRef,
        beneficiary,
        token: "FACTS",
        amount: Number(amount) / 10 ** decimals,
        usdValue: options.usdValue ?? null,
      },
    },
  }).catch(() => undefined);

  return { hash, amount, paymentRef, account };
}

/**
 * Create a staked match and escrow the creator's stake in the vault.
 * USDC and FACTS follow the exact same ERC-20 flow; the assets never mix.
 */
export async function createStakedMatch(options: {
  matchKey: string;
  asset: VaultAsset;
  stake: number;
}) {
  const { account } = await getWalletClient();
  const matchId = toBytes32(options.matchKey);
  const token = tokenAddress(options.asset);
  const decimals = await tokenDecimals(token, decimalsFor(options.asset));
  const stake = parseUnits(options.stake.toString(), decimals);
  if (stake <= 0n) throw new Error("Pick a stake amount above zero.");

  await assertBalance(token, account, stake, options.asset);
  await ensureAllowance(token, MATCH_VAULT_ADDRESS, stake, account);

  const hash = await sendWrite({
    address: MATCH_VAULT_ADDRESS,
    abi: MATCH_VAULT_ABI,
    functionName: "createMatch",
    args: [matchId, ASSET[options.asset], stake],
    account,
  });

  await recordChainEvent({
    data: {
      contract: "StakedMatchVault",
      eventName: "MatchCreated",
      txHash: hash,
      wallet: account,
      args: {
        matchId,
        matchKey: options.matchKey,
        asset: options.asset,
        stake: options.stake,
      },
    },
  }).catch(() => undefined);

  return { hash, matchId, account };
}

/** Join an open staked match by matching the creator's stake exactly. */
export async function joinStakedMatch(matchKey: string) {
  const { account } = await getWalletClient();
  const matchId = toBytes32(matchKey);
  const onchain = (await publicClient.readContract({
    address: MATCH_VAULT_ADDRESS,
    abi: MATCH_VAULT_ABI,
    functionName: "matches",
    args: [matchId],
  })) as readonly [Address, Address, Address, number, number, bigint];

  const stake = onchain[5];
  if (stake === 0n) throw new Error("That match is not open onchain yet — ask the host to stake.");

  const asset: VaultAsset = onchain[3] === ASSET.FACTS ? "FACTS" : "USDC";
  const token = tokenAddress(asset);

  await assertBalance(token, account, stake, asset);
  await ensureAllowance(token, MATCH_VAULT_ADDRESS, stake, account);

  const hash = await sendWrite({
    address: MATCH_VAULT_ADDRESS,
    abi: MATCH_VAULT_ABI,
    functionName: "joinMatch",
    args: [matchId],
    account,
  });

  await recordChainEvent({
    data: {
      contract: "StakedMatchVault",
      eventName: "MatchJoined",
      txHash: hash,
      wallet: account,
      args: { matchId, matchKey, asset, stake: Number(stake) / 10 ** decimalsFor(asset) },
    },
  }).catch(() => undefined);

  return { hash, matchId, asset, account };
}

export async function readVaultClaimable(address: Address, asset: VaultAsset) {
  return (await publicClient.readContract({
    address: MATCH_VAULT_ADDRESS,
    abi: MATCH_VAULT_ABI,
    functionName: "claimable",
    args: [address, ASSET[asset]],
  })) as bigint;
}

/** Pull staked-match winnings out of the vault. */
export async function claimMatchWinnings(asset: VaultAsset) {
  const { account } = await getWalletClient();
  const amount = await readVaultClaimable(account, asset);
  if (amount === 0n) throw new Error(`No ${asset} winnings to claim yet.`);

  const hash = await sendWrite({
    address: MATCH_VAULT_ADDRESS,
    abi: MATCH_VAULT_ABI,
    functionName: "claim",
    args: [ASSET[asset]],
    account,
  });

  await recordChainEvent({
    data: {
      contract: "StakedMatchVault",
      eventName: "WinningsClaimed",
      txHash: hash,
      wallet: account,
      args: { asset, amount: Number(amount) / 10 ** decimalsFor(asset) },
    },
  }).catch(() => undefined);

  return { hash, amount };
}

export async function readRewardClaimable(address: Address, campaignId: bigint) {
  return (await publicClient.readContract({
    address: REWARD_DISTRIBUTOR_ADDRESS,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: "claimable",
    args: [campaignId, address],
  })) as bigint;
}

export async function readNextCampaignId() {
  return (await publicClient.readContract({
    address: REWARD_DISTRIBUTOR_ADDRESS,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: "nextCampaignId",
  })) as bigint;
}

/** Total FACTS claimable for a wallet across every campaign created so far. */
export async function readTotalRewardClaimable(address: Address) {
  const next = await readNextCampaignId();
  let total = 0n;
  const campaigns: bigint[] = [];
  for (let id = 0n; id < next; id++) {
    const amount = await readRewardClaimable(address, id);
    if (amount > 0n) {
      total += amount;
      campaigns.push(id);
    }
  }
  return { total, campaigns };
}

/** Claim season / campaign FACTS rewards from the distributor. */
export async function claimRewards(campaignIds: bigint[]) {
  if (campaignIds.length === 0) throw new Error("No FACTS rewards to claim yet.");
  const { account } = await getWalletClient();

  const hash =
    campaignIds.length === 1
      ? await sendWrite({
          wait: false,
          address: REWARD_DISTRIBUTOR_ADDRESS,
          abi: REWARD_DISTRIBUTOR_ABI,
          functionName: "claim",
          args: [campaignIds[0]!],
          account,
        })
      : await sendWrite({
          wait: false,
          address: REWARD_DISTRIBUTOR_ADDRESS,
          abi: REWARD_DISTRIBUTOR_ABI,
          functionName: "claimMany",
          args: [campaignIds],
          account,
        });

  await recordChainEvent({
    data: {
      contract: "FactsRewardDistributor",
      eventName: "RewardClaimed",
      txHash: hash,
      wallet: account,
      args: { campaigns: campaignIds.map((c) => c.toString()) },
    },
  }).catch(() => undefined);

  return { hash };
}

/**
 * Send USDC straight to the treasury. Used for the flat match entry fee and
 * for USDC Season Pass purchases; the server verifies the receipt afterwards.
 */
export async function payUsdcToTreasury(options: { amountUsdc: number; memo: string }) {
  const { client, account } = await getWalletClient();
  const amount = parseUnits(options.amountUsdc.toFixed(USDC_DECIMALS), USDC_DECIMALS);

  const balance = (await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;
  if (balance < amount) {
    throw new Error(`Not enough USDC on Base — ${options.amountUsdc} USDC required.`);
  }

  const { request } = await publicClient.simulateContract({
    address: USDC_ADDRESS,
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [TREASURY_ADDRESS, amount],
    account,
  });
  const hash = await client.writeContract({ ...request, chain: client.chain });
  // The transfer is live the moment we hold a hash. A failed receipt poll is
  // "unknown", never "failed" — the server confirms it from here.
  const { confirmed } = await waitForReceiptSoft(hash, "USDC transfer");
  return { hash, account, amount: options.amountUsdc, memo: options.memo, confirmed };
}

/** Claim every FACTS campaign reward that is currently claimable. */
export async function claimAllRewards() {
  const { account } = await getWalletClient();
  const { total, campaigns } = await readTotalRewardClaimable(account);
  if (campaigns.length === 0) throw new Error("No FACTS rewards to claim yet.");
  const { hash } = await claimRewards(campaigns);
  return {
    hash,
    account,
    campaigns,
    amount: Number(total) / 10 ** FACTS_DECIMALS,
  };
}

/**
 * Claim the daily $FACTS payout for the wallet's Facts Points.
 *
 * The backend signs `getMessageHash(user, "FACTS", points)`; the contract
 * verifies that signature, enforces its own 24 hour cooldown and transfers the
 * $FACTS. The signature is never produced in the browser.
 */
export async function claimFactsForPoints(options: { points: number; signature: string }) {
  const { FACTS_CLAIM_ABI, FACTS_CLAIM_ADDRESS, FACTS_CLAIM_SYMBOL } = await import("./contracts");
  const { account } = await getWalletClient();
  const hash = await sendWrite({
    address: FACTS_CLAIM_ADDRESS,
    abi: FACTS_CLAIM_ABI,
    functionName: "claimReward",
    args: [FACTS_CLAIM_SYMBOL, BigInt(Math.max(0, Math.floor(options.points))), options.signature],
    account,
    wait: false,
  });
  await waitForReceiptSoft(hash, "daily claim");
  return { hash, account };
}
