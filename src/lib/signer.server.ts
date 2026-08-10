/**
 * The FarAction backend signer.
 *
 * The same key authorises daily $FACTS claims (an off-chain signature the
 * reward contract verifies) and settles staked matches as the vault operator.
 * It never leaves the server.
 */
import { createWalletClient, http, type Account, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

function readKey(): `0x${string}` {
  const raw = process.env["BACKEND_SIGNER_KEY"];
  if (!raw) throw new Error("The backend signer is not configured.");
  const trimmed = raw.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as `0x${string}`;
}

export function signerAccount(): Account {
  return privateKeyToAccount(readKey());
}

export function signerWallet(): { client: WalletClient; account: Account } {
  const account = signerAccount();
  const rpc = process.env["BASE_RPC_URL"] ?? "https://mainnet.base.org";
  const client = createWalletClient({ account, chain: base, transport: http(rpc) });
  return { client, account };
}