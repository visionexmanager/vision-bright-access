import { describe, expect, it } from "vitest";
import { academyModules } from "./moduleRegistry";

describe("academy module registry", () => {
  it("keeps every live module on a registered academy route or a deliberate integration route", () => {
    const ids = academyModules.map((module) => module.id);
    const routes = academyModules.map((module) => module.plannedRoute);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
    expect(academyModules.every((module) => module.status === "live")).toBe(true);
    expect(academyModules.every((module) => module.plannedRoute.startsWith("/academy") || module.plannedRoute === "/community")).toBe(true);
  });
});
