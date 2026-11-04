import { it, expect } from "vitest";
import { parseVisionMode } from "../../supabase/functions/_shared/whatsappVisionModes.ts";
import { detectLanguage, languageOfMessage } from "../../supabase/functions/_shared/whatsappLanguageDetect.ts";
it("recognises media commands and short single-script messages in any language", () => {
  expect(parseVisionMode("décris cette image")?.mode).toBe("describe");
  expect(parseVisionMode("lee el texto")?.mode).toBe("read_text");
  expect(parseVisionMode("Was ist das Produkt")?.mode).toBe("product");
  expect(parseVisionMode("traduce esto al inglés")?.mode).toBe("translate");
  expect(parseVisionMode("прочитай")?.mode).toBe("read_text");
  expect(languageOfMessage("你好")).toBe("zh");
  expect(languageOfMessage("привет")).toBe("ru");
  expect(languageOfMessage("ok")).toBeNull();
  expect(languageOfMessage("سلام")).toBeNull();
});
