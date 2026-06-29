import { Test, TestingModule } from "@nestjs/testing";
import { StreamHealthService } from "./stream-health.service";
import { DB_POOL }             from "../../database/database.module";
import { REDIS_CLIENT }        from "../../database/redis.module";

const mockDb = { query: jest.fn() };
const mockRedis = {
  hget:    jest.fn(),
  hset:    jest.fn(),
  hgetall: jest.fn(),
  hincrby: jest.fn(),
  hdel:    jest.fn(),
  expire:  jest.fn(),
};

describe("StreamHealthService", () => {
  let svc: StreamHealthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamHealthService,
        { provide: DB_POOL,      useValue: mockDb },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();
    svc = module.get(StreamHealthService);
  });

  describe("getSnapshot", () => {
    it("returns score=100 with no data", async () => {
      mockRedis.hgetall.mockResolvedValue(null);
      const snap = await svc.getSnapshot("src-1");
      expect(snap.score).toBe(100);
      expect(snap.avgLatencyMs).toBe(0);
    });

    it("penalises high latency", async () => {
      mockRedis.hgetall.mockResolvedValue({
        latency_samples: JSON.stringify([5000, 6000]),
        buffer_events: "0",
        error_events:  "0",
      });
      const snap = await svc.getSnapshot("src-1");
      // latency_score ≈ 100 - (5500-2000)/80 = 100 - 43.75 ≈ 56
      // full score = 0.30*56 + 0.40*100 + 0.30*100 = 16.8 + 40 + 30 = 86.8 ≈ 87
      expect(snap.score).toBeLessThan(100);
      expect(snap.score).toBeGreaterThan(80);
    });

    it("penalises buffer events", async () => {
      mockRedis.hgetall.mockResolvedValue({
        latency_samples: JSON.stringify([1000]),
        buffer_events: "4",
        error_events:  "0",
      });
      const snap = await svc.getSnapshot("src-1");
      // buffer_score = max(0, 100 - 4*15) = 40
      expect(snap.bufferEvents).toBe(4);
      expect(snap.score).toBeLessThan(80);
    });

    it("penalises errors heavily", async () => {
      mockRedis.hgetall.mockResolvedValue({
        latency_samples: JSON.stringify([5000]),
        buffer_events: "0",
        error_events:  "3",
      });
      const snap = await svc.getSnapshot("src-1");
      // latency_score = 100 - (5000-2000)/80 = 62.5
      // error_score   = max(0, 100 - 3*25)   = 25
      // score = 0.30*62.5 + 0.40*100 + 0.30*25 = 66.25 → 66
      expect(snap.errorEvents).toBe(3);
      expect(snap.score).toBeLessThan(70);
    });
  });

  describe("recordLatency", () => {
    it("stores latency sample and caps at 10 entries", async () => {
      const existing = Array(10).fill(1000);
      mockRedis.hget.mockResolvedValue(JSON.stringify(existing));
      mockRedis.hgetall.mockResolvedValue({ latency_samples: JSON.stringify([...existing.slice(1), 500]) });
      mockDb.query.mockResolvedValue({ rows: [{ reliability: 95, latency_ms: null }] });

      await svc.recordLatency("src-1", 500);

      const call = mockRedis.hset.mock.calls[0];
      const stored: number[] = JSON.parse(call[2]);
      expect(stored.length).toBeLessThanOrEqual(10);
      expect(stored.at(-1)).toBe(500);
    });
  });

  describe("score formula", () => {
    const cases: [number, number, number, number][] = [
      // [latency, bufferEvents, errorEvents, minExpectedScore]
      [500,  0, 0, 99],
      [2000, 0, 0, 99],
      [5000, 0, 0, 80],
      [800,  6, 0, 30],
      [800,  0, 4, 0],
    ];
    test.each(cases)("latency=%ims buffer=%i errors=%i → score≥%i", (lat, buf, err, min) => {
      // Access private method via any cast
      const score = (svc as any).computeScore(lat, buf, err);
      expect(score).toBeGreaterThanOrEqual(min);
    });
  });
});
