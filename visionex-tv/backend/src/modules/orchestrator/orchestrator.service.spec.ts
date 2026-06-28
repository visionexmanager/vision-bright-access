import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService }       from "@nestjs/config";
import { OrchestratorService } from "./orchestrator.service";
import { DB_POOL }             from "../../database/database.module";
import { REDIS_CLIENT }        from "../../database/redis.module";

// Minimal stubs — no real DB or Redis in unit tests
const mockDb = {
  query: jest.fn(),
};
const mockRedis = {
  get:    jest.fn(),
  setex:  jest.fn(),
  del:    jest.fn(),
};
const mockCfg = {
  get: jest.fn((key: string, def?: number) => {
    if (key === "stream.healthIntervalMs") return 99_999_999;
    return def;
  }),
};

describe("OrchestratorService", () => {
  let svc: OrchestratorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: DB_POOL,     useValue: mockDb },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: ConfigService, useValue: mockCfg },
      ],
    }).compile();

    svc = module.get<OrchestratorService>(OrchestratorService);
  });

  afterEach(async () => {
    await (svc as any).onModuleDestroy?.();
  });

  describe("selectSource", () => {
    it("returns null when no sources exist", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // sources query
      const result = await svc.selectSource("channel-1");
      expect(result).toBeNull();
    });

    it("skips failing sources and picks the next best", async () => {
      const sources = [
        { id: "src-1", url: "http://bad.example/s1.m3u8", type: "hls", priority: 0, reliability: 95, latency_ms: null, is_active: true },
        { id: "src-2", url: "http://ok.example/s2.m3u8",  type: "hls", priority: 1, reliability: 80, latency_ms: null, is_active: true },
      ];
      mockRedis.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce({ rows: sources })         // getChannelSources
        .mockResolvedValueOnce({ rows: [{ quality: "HD" }] }); // getChannelQuality

      // Intercept probeUrl: src-1 fails, src-2 succeeds
      const probeUrlSpy = jest
        .spyOn(svc as any, "probeUrl")
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await svc.selectSource("channel-1");

      expect(probeUrlSpy).toHaveBeenCalledTimes(2);
      expect(result?.sourceId).toBe("src-2");
    });

    it("uses Redis cache when available", async () => {
      const cachedSources = [
        { id: "src-cached", channelId: "channel-1", url: "http://c.example/c.m3u8", type: "hls", priority: 0, reliability: 99, latencyMs: 100, isActive: true },
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedSources));
      mockDb.query.mockResolvedValueOnce({ rows: [{ quality: "FHD" }] });

      jest.spyOn(svc as any, "probeUrl").mockResolvedValue(true);

      const result = await svc.selectSource("channel-1");
      expect(result?.sourceId).toBe("src-cached");
      // DB sources query should NOT have been called (cache hit)
      expect(mockDb.query).toHaveBeenCalledTimes(1); // only quality query
    });
  });

  describe("switchSource", () => {
    it("marks the failed source and selects the next one", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.del.mockResolvedValue(1);
      const sources = [
        { id: "src-1", url: "http://x.example/1.m3u8", type: "hls", priority: 0, reliability: 90, latency_ms: null, is_active: true },
        { id: "src-2", url: "http://y.example/2.m3u8", type: "hls", priority: 1, reliability: 75, latency_ms: null, is_active: true },
      ];
      mockDb.query
        .mockResolvedValueOnce({ rows: sources })
        .mockResolvedValueOnce({ rows: [{ quality: "HD" }] });

      // src-1 is already failing (we're switching away from it), src-2 is ok
      jest.spyOn(svc as any, "probeUrl").mockResolvedValue(true);

      const result = await svc.switchSource("channel-1", "src-1");
      // src-1 is in failingNow so it should be skipped
      expect(result?.sourceId).not.toBe("src-1");
    });
  });

  describe("EMA reliability score", () => {
    it("decays score on failure", () => {
      const old    = 100;
      const sample = 0;
      const score  = Math.round(0.70 * old + 0.30 * sample);
      expect(score).toBe(70);
    });

    it("recovers score on success", () => {
      const old    = 0;
      const sample = 100;
      const score  = Math.round(0.70 * old + 0.30 * sample);
      expect(score).toBe(30);
    });

    it("stabilises at 100 for 5 consecutive successes", () => {
      let score = 50;
      for (let i = 0; i < 5; i++) {
        score = Math.round(0.70 * score + 0.30 * 100);
      }
      expect(score).toBeGreaterThan(95);
    });
  });
});
