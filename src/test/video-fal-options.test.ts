import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  FAL_VIDEO_OPTIONS,
  VIDEO_MARKUP_PERCENT,
  VX_PER_USD,
  aspectFor,
  checkOption,
  findFalVideoOption,
  vxForClip,
  vxPerSecond,
} from "../../supabase/functions/_shared/providers/falVideoOptions";
import { FAL_MODELS } from "../../supabase/functions/_shared/providers/fal";
import { SERVICE_IDS } from "../../supabase/functions/_shared/vx/types";

const migration = readFileSync("supabase/migrations/20261103000000_video_fal_options_pricing.sql", "utf8");
const studio = readFileSync("supabase/functions/video-studio/index.ts", "utf8");

describe("the priced fal video options", () => {
  it("charges fal's price per second at the stated rate of 1,000 VX to the dollar", () => {
    expect(VX_PER_USD).toBe(1000);
    const perSecond = Object.fromEntries(FAL_VIDEO_OPTIONS.map((o) => [o.id, vxPerSecond(o)]));
    expect(perSecond).toEqual({ wan: 30, pixverse: 45, grok: 50, kling: 70, kling_audio: 140 });
  });

  it("prices a whole clip as seconds times the rate", () => {
    const kling = findFalVideoOption("kling")!;
    expect(vxForClip(kling, 5)).toBe(350);
    expect(vxForClip(kling, 10)).toBe(700);
    expect(vxForClip(findFalVideoOption("wan")!, 5)).toBe(150);
  });

  it("is registered in the pricing table with the same price, per second, for every option", () => {
    for (const option of FAL_VIDEO_OPTIONS) {
      const row = migration.split("\n").find((line) => line.includes(`'${option.serviceId}'`));
      expect(row, option.id).toBeDefined();
      const [, basePart, pricePart] = row!.match(/'fal',\s*([0-9.]+),\s*(\d+),/)!;
      expect(Number(pricePart), `${option.id} vx_price`).toBe(vxPerSecond(option));
      expect(Number(basePart), `${option.id} base_cost`).toBeCloseTo(option.costMilliUsdPerSecond / 1000, 6);
      expect(SERVICE_IDS).toContain(option.serviceId);
    }
    expect(VIDEO_MARKUP_PERCENT).toBe(100);
  });

  it("only sends work to endpoints fal marks for commercial use", () => {
    for (const option of FAL_VIDEO_OPTIONS) {
      const model = (FAL_MODELS as Record<string, { kind: string; commercial: boolean }>)[option.endpoint];
      expect(model?.kind, option.id).toBe("video");
      expect(model?.commercial, option.id).toBe(true);
    }
  });

  it("fixes resolution and sound, so the price shown is the price of what is rendered", () => {
    const base = { prompt: "a boat", aspectRatio: "16:9", durationSec: 5, resolution: "1080p", audio: true } as never;
    const input = (id: string) => findFalVideoOption(id)!.input(base) as Record<string, unknown>;
    expect(input("pixverse")).toMatchObject({ resolution: "720p", generate_audio_switch: false, duration: 5 });
    expect(input("grok")).toMatchObject({ resolution: "480p", duration: 5 });
    expect(input("kling")).toMatchObject({ generate_audio: false, duration: "5" });
    expect(input("kling_audio")).toMatchObject({ generate_audio: true, duration: "5" });
    expect(input("wan")).toMatchObject({ resolution: "720p" });
  });

  it("refuses what it cannot render exactly as priced, rather than rounding it", () => {
    expect(checkOption("nope", 5, "a boat")).toEqual({ ok: false, reason: "unknown_option" });
    expect(checkOption("wan", 10, "a boat")).toEqual({ ok: false, reason: "duration_not_offered" });
    expect(checkOption("kling", 7, "a boat")).toEqual({ ok: false, reason: "duration_not_offered" });
    expect(checkOption("kling", 10, "a boat")).toMatchObject({ ok: true });
    // Arabic letters are two bytes each: 1,100 of them overflow PixVerse's 2,048 bytes.
    expect(checkOption("pixverse", 5, "ب".repeat(1100))).toEqual({ ok: false, reason: "prompt_too_long" });
    expect(checkOption("kling", 5, "ب".repeat(1100))).toMatchObject({ ok: true });
  });

  it("renders a shape the option does not offer as 16:9", () => {
    const kling = findFalVideoOption("kling")!;
    expect(aspectFor(kling, "9:16")).toBe("9:16");
    expect(aspectFor(kling, "4:3")).toBe("16:9");
    expect(aspectFor(kling, undefined)).toBe("16:9");
  });
});

describe("the video studio charges for it", () => {
  it("holds the VX before the provider is called, keyed on the job", () => {
    const hold = studio.indexOf("databasePorts(dbService).reserve");
    const submit = studio.indexOf("await provider.generateVideo(");
    expect(hold).toBeGreaterThan(0);
    expect(hold).toBeLessThan(submit);
    expect(studio).toContain("idempotencyKey: `video:${job.id}`");
    expect(studio).toContain("units: clipSeconds");
  });

  it("returns the hold on every way a job can fail or be cancelled, and settles on completion", () => {
    const releases = studio.match(/closeReservation\(dbService, job, "release"/g) ?? [];
    expect(releases.length).toBeGreaterThanOrEqual(5);
    expect(studio).toContain('closeReservation(dbService, job, "settle", "completed")');
  });

  it("finds the hold by its key and owner, never by an id the job row carries", () => {
    const body = studio.slice(studio.indexOf("async function closeReservation"), studio.indexOf("async function handleOptions"));
    expect(body).toContain('.eq("idempotency_key"');
    expect(body).toContain('.eq("user_id", job.user_id)');
    expect(body).toContain('row.status !== "reserved"');
  });

  it("answers a short balance with the amounts, and a refused hold deletes the job it created", () => {
    expect(studio).toContain('error: "insufficient_vx"');
    expect(studio).toContain(".delete().eq(\"id\", job.id)");
  });
});
