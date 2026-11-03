import { describe, expect, it } from "vitest";
import { readableTitle } from "../../supabase/functions/_shared/whatsappExternalFiles";

describe("readableTitle", () => {
  it("keeps real words", () => {
    expect(readableTitle("Full Moon over Petra")).toBe("Full Moon over Petra");
  });
  it("drops camera-file names a screen reader would garble", () => {
    expect(readableTitle("IMG 4821")).toBe("");
    expect(readableTitle("P1020345")).toBe("");
    expect(readableTitle("DSC_0042 2010")).toBe("");
  });
});
