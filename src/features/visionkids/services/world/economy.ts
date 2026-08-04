import { kidsDb, rpcResult } from "@/features/visionkids/services/stories/kidsSupabase";
import type { BuyResult } from "@/features/visionkids/types/world.types";

/** Read the child's VX coin balance (the real wallet is public.user_points;
 *  balance is the sum of its points rows). */
export async function fetchCoinBalance(): Promise<number> {
  const { data: auth } = await kidsDb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return 0;
  const { data, error } = await kidsDb
    .from("user_points").select("points").eq("user_id", userId)
    .returns<{ points: number }[]>();
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + (r.points ?? 0), 0);
}

/** Purchase a Marketplace item. Price + ownership + balance are all enforced
 *  server-side by buy_kids_item (which calls spend_vx). */
export async function buyItem(itemSlug: string): Promise<BuyResult> {
  const { data, error } = await kidsDb.rpc("buy_kids_item", { _item_slug: itemSlug });
  if (error) throw error;
  return rpcResult<BuyResult>(data);
}
