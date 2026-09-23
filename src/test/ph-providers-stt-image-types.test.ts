// Phase 2C — ph_providers.type widened to add 'stt' and 'image'. Additive
// and inert on its own: no caller reads a 'stt' or 'image' row yet, so this
// migration is asserted against on its own terms rather than through a
// caller (wiring one is Phase 2D, a separate change to those call sites).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261037000000_ph_providers_stt_image_types.sql", "utf8");

describe("the type constraint gains exactly two new values", () => {
  it("drops and replaces the constraint, rather than leaving the old one behind", () => {
    expect(migration).toContain("ALTER TABLE ph_providers DROP CONSTRAINT ph_providers_type_check;");
    expect(migration).toContain(
      "CHECK (type IN ('tts', 'voice_cloning', 'text_to_video', 'stt', 'image'));"
    );
  });

  it("touches no other table and creates none", () => {
    expect(migration).not.toMatch(/CREATE TABLE/i);
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/ALTER TABLE (?!ph_providers)/i);
  });
});

describe("the seeded rows match the fallback order already live in production", () => {
  it("orders groq-stt ahead of openai-stt, matching _shared/voice/stt.ts's real chain", () => {
    const sttRows = migration.slice(migration.indexOf("-- STT"), migration.indexOf("-- Image"));
    const groqAt = sttRows.indexOf("'groq-stt'");
    const openaiAt = sttRows.indexOf("'openai-stt'");
    expect(groqAt).toBeGreaterThan(-1);
    expect(openaiAt).toBeGreaterThan(groqAt);
    expect(sttRows).toContain("'whisper-large-v3-turbo'");
    expect(sttRows).toContain("'whisper-1'");
  });

  it("seeds openai-image with the model contentMedia.ts actually calls first", () => {
    const insertValues = migration.slice(migration.indexOf("INSERT INTO ph_providers"));
    expect(insertValues).toContain("'openai-image', 'image'");
    expect(insertValues).toContain("'gpt-image-1'");
    // The mini fallback is a same-vendor model fallback inside contentMedia.ts,
    // not a second provider row (explained in the comment above, but the
    // VALUES themselves carry only the primary model) — see the architecture
    // doc's §D.
    expect(insertValues).not.toContain("gpt-image-1-mini");
  });

  it("deliberately seeds no Replicate row, and says why", () => {
    const insertValues = migration.slice(migration.indexOf("INSERT INTO ph_providers"));
    expect(insertValues).not.toMatch(/'replicate/i);
    expect(migration).toContain("Replicate");
    expect(migration).toMatch(/serves five\s*\n?-- different Replicate models/);
  });

  it("leaves cost_per_request at the column default rather than inventing a figure", () => {
    const insert = migration.slice(migration.indexOf("INSERT INTO ph_providers"));
    expect(insert).not.toContain("cost_per_request");
  });

  it("all three new rows use ON CONFLICT DO NOTHING, matching the original seed's safety", () => {
    expect(migration).toContain("ON CONFLICT (slug) DO NOTHING;");
  });
});
