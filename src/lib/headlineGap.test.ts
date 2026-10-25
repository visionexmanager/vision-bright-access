import { describe, expect, it } from "vitest";
import { headlineGap } from "./headlineGap";

describe("headlineGap", () => {
  it("adds a space when the lead text does not end in one", () => {
    expect(headlineGap("ru", "Visionex объединяет всё в")).toBe(" ");
    expect(headlineGap("ko", "Visionex는 모든 것을")).toBe(" ");
  });

  it("adds nothing when the lead text already ends in whitespace", () => {
    expect(headlineGap("en", "Visionex brings everything into ")).toBe("");
  });

  it("adds nothing in Japanese and Chinese, which are written without spaces", () => {
    expect(headlineGap("ja", "Visionexはすべてを「")).toBe("");
    expect(headlineGap("zh", "Visionex 将所有内容汇聚到")).toBe("");
  });
});
