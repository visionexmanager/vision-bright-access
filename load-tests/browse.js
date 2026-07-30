import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

/**
 * VisionKids read-heavy browse load test.
 *
 * Simulates the dominant traffic shape for a kids' content platform: anonymous
 * / logged-in children browsing the SPA shell and public content over the
 * Supabase REST + CDN edge. Read-only — it never writes, so it is safe to run
 * against a staging project. Point it at staging via BASE_URL.
 *
 *   BASE_URL=https://staging.visionex.app k6 run load-tests/browse.js
 *
 * Tune the ramp with --stage or the STAGES env; defaults model ~100 → ~1000 VUs.
 */

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const errorRate = new Rate("errors");

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 }, // warm up to 100 VUs
        { duration: "3m", target: 100 }, // hold
        { duration: "2m", target: 1000 }, // ramp to 1000
        { duration: "3m", target: 1000 }, // hold
        { duration: "1m", target: 0 }, // ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // Launch-gate SLOs — fail the run if these regress.
    http_req_duration: ["p(95)<800", "p(99)<2000"],
    errors: ["rate<0.01"],
  },
};

// Public, read-only surfaces. Adjust paths to match your routes.
const PATHS = ["/", "/kids", "/kids/stories", "/kids/games", "/kids/status"];

export default function () {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const res = http.get(`${BASE_URL}${path}`, { tags: { path } });
  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "served quickly": (r) => r.timings.duration < 2000,
  });
  errorRate.add(!ok);
  sleep(Math.random() * 3 + 1); // 1–4s think time
}
