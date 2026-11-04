import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

const { fetchExternalFile, FileUnavailableError } = await import("@/services/library/externalContent");

describe("fetchExternalFile", () => {
  beforeEach(() => invoke.mockReset());

  it("asks the server for the file by item id and returns a typed blob with its name", async () => {
    invoke.mockResolvedValue({ data: { ok: true, mimeType: "image/png", fileName: "moon.png", data: btoa("PNGDATA") }, error: null });
    const file = await fetchExternalFile("pexels:photo:1");
    expect(invoke).toHaveBeenCalledWith("library-research-assistant", { body: { mode: "content_file", item_id: "pexels:photo:1" } });
    expect(file.fileName).toBe("moon.png");
    expect(file.blob.type).toBe("image/png");
    expect(file.blob.size).toBe(7);
  });

  it("throws FileUnavailableError with the server's reason when the source only allows its own page", async () => {
    const context = new Response(JSON.stringify({ error: "file_unavailable", reason: "not_deliverable" }), { status: 422 });
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error("non-2xx"), { context }) });
    const err = await fetchExternalFile("unsplash:1").catch((e) => e);
    expect(err).toBeInstanceOf(FileUnavailableError);
    expect(err.reason).toBe("not_deliverable");
  });

  it("treats a malformed answer as unavailable, never as an empty file", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(fetchExternalFile("x:1")).rejects.toBeInstanceOf(FileUnavailableError);
  });
});
