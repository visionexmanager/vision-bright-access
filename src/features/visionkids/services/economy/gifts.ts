import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { Gift, GiftKind } from "@/features/visionkids/types/economy.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchGifts(): Promise<{ sent: Gift[]; received: Gift[] }> {
  const userId = await currentUserId();
  if (!userId) return { sent: [], received: [] };
  const { data, error } = await kidsDb
    .from("kids_gifts").select("*").or(`from_id.eq.${userId},to_id.eq.${userId}`).order("created_at", { ascending: false })
    .returns<Gift[]>();
  if (error) throw error;
  const rows = data ?? [];
  return { sent: rows.filter((g) => g.from_id === userId), received: rows.filter((g) => g.to_id === userId) };
}

export interface CreateGiftInput {
  toId: string;
  kind: GiftKind;
  refSlug?: string;
  amount?: number;
  message?: string;
}

export async function createGift(input: CreateGiftInput): Promise<string> {
  const { data, error } = await kidsDb.rpc("create_kids_gift", {
    _to_id: input.toId, _kind: input.kind, _ref_slug: input.refSlug ?? null, _amount: input.amount ?? 0, _message: input.message ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function claimGift(id: string): Promise<void> {
  const { error } = await kidsDb.rpc("claim_kids_gift", { _id: id });
  if (error) throw error;
}
