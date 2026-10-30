import { beforeEach, describe, expect, it } from "vitest";
import { isAndroidApp } from "./androidApp";

describe("isAndroidApp", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("is false in an ordinary browser", () => {
    expect(isAndroidApp()).toBe(false);
  });

  it("is true for the app's start url, and stays true on later pages", () => {
    window.history.replaceState({}, "", "/?source=twa");
    expect(isAndroidApp()).toBe(true);
    window.history.replaceState({}, "", "/pricing");
    expect(isAndroidApp()).toBe(true);
  });

  it("ignores other sources", () => {
    window.history.replaceState({}, "", "/games?source=pwa");
    expect(isAndroidApp()).toBe(false);
  });
});
