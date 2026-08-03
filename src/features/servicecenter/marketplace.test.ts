import { describe, expect, it } from "vitest";
import {
  ORDER_FLOW,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_HINT,
  ORDER_STATUS_LABEL,
  canRate,
  isTerminal,
  orderProgress,
  parseOrderStatus,
  sortOrders,
  type ServiceOrder,
} from "./marketplace";

const order = (over: Partial<ServiceOrder>): ServiceOrder => ({
  id: "1",
  serviceType: "web-design",
  message: "brief",
  status: "pending",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("parseOrderStatus", () => {
  it("passes through known statuses", () => {
    expect(parseOrderStatus("in_progress")).toBe("in_progress");
    expect(parseOrderStatus("completed")).toBe("completed");
  });

  it("normalises casing, spaces and hyphens from free-text database values", () => {
    expect(parseOrderStatus("In Progress")).toBe("in_progress");
    expect(parseOrderStatus("in-progress")).toBe("in_progress");
    expect(parseOrderStatus("  QUOTED ")).toBe("quoted");
  });

  it("falls back to pending for unknown, empty or missing values", () => {
    expect(parseOrderStatus("banana")).toBe("pending");
    expect(parseOrderStatus("")).toBe("pending");
    expect(parseOrderStatus(null)).toBe("pending");
    expect(parseOrderStatus(undefined)).toBe("pending");
  });
});

describe("orderProgress", () => {
  it("runs from 0 to 100 across the happy path", () => {
    expect(orderProgress("pending")).toBe(0);
    expect(orderProgress("completed")).toBe(100);
  });

  it("increases monotonically along the flow", () => {
    let previous = -1;
    for (const status of ORDER_FLOW) {
      const value = orderProgress(status);
      expect(value, status).toBeGreaterThan(previous);
      previous = value;
    }
  });

  it("reports zero for a cancelled order rather than a misleading position", () => {
    expect(orderProgress("cancelled")).toBe(0);
  });
});

describe("isTerminal and canRate", () => {
  it("treats completed and cancelled as finished", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("in_progress")).toBe(false);
  });

  it("only allows rating work that was actually completed", () => {
    expect(canRate("completed")).toBe(true);
    expect(canRate("cancelled")).toBe(false);
    expect(canRate("delivered")).toBe(false);
  });
});

describe("sortOrders", () => {
  it("puts open orders ahead of finished ones", () => {
    const sorted = sortOrders([
      order({ id: "done", status: "completed", createdAt: "2026-06-01T00:00:00.000Z" }),
      order({ id: "open", status: "in_progress", createdAt: "2026-01-01T00:00:00.000Z" }),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(["open", "done"]);
  });

  it("sorts newest first inside each group", () => {
    const sorted = sortOrders([
      order({ id: "older", createdAt: "2026-01-01T00:00:00.000Z" }),
      order({ id: "newer", createdAt: "2026-05-01T00:00:00.000Z" }),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(["newer", "older"]);
  });

  it("does not mutate the input", () => {
    const input = [order({ id: "a", status: "completed" }), order({ id: "b" })];
    sortOrders(input);
    expect(input.map((o) => o.id)).toEqual(["a", "b"]);
  });
});

describe("status copy", () => {
  it("labels, explains and styles every status in both languages", () => {
    for (const status of Object.keys(ORDER_STATUS_LABEL) as (keyof typeof ORDER_STATUS_LABEL)[]) {
      expect(ORDER_STATUS_LABEL[status].ar.trim(), status).not.toBe("");
      expect(ORDER_STATUS_HINT[status].en.trim(), status).not.toBe("");
      expect(ORDER_STATUS_HINT[status].ar.trim(), status).not.toBe("");
      expect(ORDER_STATUS_CLASS[status], status).toBeDefined();
    }
  });
});
