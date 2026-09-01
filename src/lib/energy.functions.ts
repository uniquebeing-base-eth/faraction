/**
 * Fighter energy boosts bought in the Black Market.
 *
 * Each boost is a one-off purchase in $FACTS that permanently raises a single
 * fighter's energy pool, letting it hold higher-cost cards.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const walletSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

/** Bonus energy per fighter for this wallet. */
export const listFighterEnergy = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ wallet: walletSchema }).parse(d))
  .handler(async ({ data }) => {
    const { getSupabasePublic } = await import("./supabase-public.server");
    const { data: rows, error } = await getSupabasePublic().rpc("list_fighter_energy", {
      p_wallet: data.wallet.toLowerCase(),
    });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      fighterId: String(r.fighter_id),
      bonusEnergy: Number(r.bonus_energy ?? 0),
    }));
  });

/** Record a paid boost and return the fighter's new bonus energy. */
export const recordEnergyPurchase = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        wallet: walletSchema,
        itemId: z.string().min(1).max(32),
        fighterId: z.string().min(1).max(32),
        energy: z.number().int().min(1).max(10),
        amountFacts: z.number().nonnegative().max(1e12),
        txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getSupabasePublic } = await import("./supabase-public.server");
    const { data: total, error } = await getSupabasePublic().rpc("record_energy_purchase", {
      p_wallet: data.wallet.toLowerCase(),
      p_item_id: data.itemId,
      p_fighter_id: data.fighterId,
      p_energy: data.energy,
      p_amount: data.amountFacts,
      p_tx_hash: data.txHash,
    });
    if (error) throw new Error(error.message);
    return { fighterId: data.fighterId, bonusEnergy: Number(total ?? 0) };
  });
