import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260826000000_arcade_economy_anticheat.sql", "utf8");

describe("Arcade economy security migration", () => {
  it("keeps VX writes server-only and idempotent", () => {
    expect(sql).toContain("revoke all on function public.arcade_append_vx");
    expect(sql).toContain("idempotency_key text not null unique");
    expect(sql).toContain('drop policy if exists "Users can insert their own points"');
    expect(sql).not.toContain("Game win reward%");
    expect(sql).not.toMatch(/create policy[^;]+arcade_wallet_transactions[^;]+for insert/i);
    expect(sql).not.toMatch(/create policy[^;]+arcade_reward_claims[^;]+for insert/i);
  });

  it("validates results before recording or rewarding them", () => {
    const validation = sql.indexOf("verdict:=case");
    const record = sql.indexOf("perform public.arcade_record_game_result");
    const reward = sql.indexOf("perform public.arcade_append_vx(uid,reward");
    expect(validation).toBeGreaterThan(-1);
    expect(record).toBeGreaterThan(validation);
    expect(reward).toBeGreaterThan(record);
    expect(sql).toContain("Duplicate session");
    expect(sql).toContain("rate_limit");
  });

  it("only sells cosmetic item classes", () => {
    expect(sql).toContain("item_type in ('theme','avatar','badge','frame','effect')");
    expect(sql).not.toContain("power_up");
    expect(sql).not.toContain("pay_to_win");
  });
});
