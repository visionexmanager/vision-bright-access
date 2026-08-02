import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(import.meta.dirname, "../../../../supabase/migrations/20260825000000_arcade_player_gamification.sql"), "utf8");
describe("Arcade gamification migration security", () => {
  it("keeps score and XP writes behind server functions", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("Session already recorded");
    expect(sql).not.toMatch(/create policy[^;]+arcade_xp_history[^;]+for insert/is);
    expect(sql).not.toMatch(/create policy[^;]+arcade_game_scores[^;]+for insert/is);
  });
  it("does not grant direct profile stat updates", () => {
    expect(sql).not.toMatch(/create policy[^;]+arcade_gamer_profiles[^;]+for update/is);
    expect(sql).toContain("arcade_update_gamer_profile");
  });
});
