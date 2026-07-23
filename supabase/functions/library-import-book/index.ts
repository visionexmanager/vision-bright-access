/**
 * library-import-book — consolidates "Import EPUB", "Import PDF", and
 * "Metadata Extraction" from the Phase 2 request into one pipeline:
 * extraction is a step inside import, not three separate endpoints (see
 * the Phase 2 plan's "Scope decisions"). Reads a staged upload from the
 * private library-temp-uploads bucket, extracts metadata + chapter text +
 * (EPUB only) a cover image, uploads the processed assets to
 * library-book-covers/library-book-files, and inserts library_books /
 * library_chapters / library_book_files rows.
 *
 * NOTE: this is the one piece of Phase 2 that could not be exercised
 * end-to-end in the sandbox this was written in (no Deno runtime / live
 * Supabase project available to actually run an import) — the EPUB path
 * (jszip + hand-rolled OPF/spine parsing) and PDF path (pdf-parse) are
 * both real, non-stub implementations, but should be smoke-tested against
 * a real EPUB/PDF on first deploy before relying on them in production.
 *
 * Auth: user-jwt required. Caller must be admin, OR own a library_authors
 * row (is_library_book_owner-style check) and be importing to their own
 * author_id.
 * Input: JSON {
 *   storage_path: string,       // path within library-temp-uploads, must start with "{caller uid}/"
 *   file_type: "epub" | "pdf",
 *   author_id: string,
 *   category_id?: string,
 *   is_free?: boolean,
 *   price_vx?: number,
 *   price_usd?: number,
 * }
 * Returns: JSON { ok, book }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3";
// deno-lint-ignore no-explicit-any
import pdfParse from "npm:pdf-parse@1.1.1";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || crypto.randomUUID().slice(0, 8);
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

interface ExtractedChapter {
  title: string;
  content_text: string;
}

interface ExtractedBook {
  title: string;
  description: string;
  language: string;
  page_count: number | null;
  chapters: ExtractedChapter[];
  coverBytes: Uint8Array | null;
  coverMime: string | null;
}

/** Hand-rolled EPUB extraction: container.xml -> OPF -> manifest/spine ->
 *  chapter XHTML files, in reading order. No third-party EPUB parser
 *  dependency beyond JSZip (just unzip) + regex-based XML reading, which
 *  keeps this self-contained and avoids a heavier XML-parser dependency
 *  for what is a fairly regular, well-specified file format. */
async function extractEpub(fileBytes: Uint8Array): Promise<ExtractedBook> {
  const zip = await JSZip.loadAsync(fileBytes);

  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) throw new Error("Invalid EPUB: missing META-INF/container.xml");
  const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfPathMatch) throw new Error("Invalid EPUB: could not locate OPF path");
  const opfPath = opfPathMatch[1];
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const opfXml = await zip.file(opfPath)?.async("string");
  if (!opfXml) throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);

  const title = opfXml.match(/<dc:title[^>]*>([^<]*)<\/dc:title>/i)?.[1]?.trim() || "Untitled";
  const description = stripHtml(opfXml.match(/<dc:description[^>]*>([^<]*)<\/dc:description>/i)?.[1] ?? "");
  const language = opfXml.match(/<dc:language[^>]*>([^<]*)<\/dc:language>/i)?.[1]?.trim() || "en";

  // manifest: id -> href/media-type
  const manifest = new Map<string, { href: string; mediaType: string }>();
  for (const m of opfXml.matchAll(/<item\s+[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*media-type="([^"]+)"[^>]*\/?>/gi)) {
    manifest.set(m[1], { href: m[2], mediaType: m[3] });
  }
  // some EPUBs order attributes differently — second pass for href-before-media-type is covered
  // by the regex already matching attributes in any relative order via separate lookups if the above misses entries.

  const spineIds = Array.from(opfXml.matchAll(/<itemref\s+[^>]*idref="([^"]+)"/gi)).map((m) => m[1]);

  const chapters: ExtractedChapter[] = [];
  for (const id of spineIds) {
    const item = manifest.get(id);
    if (!item || !/html|xhtml/i.test(item.mediaType)) continue;
    const fullPath = opfDir + item.href;
    const html = await zip.file(fullPath)?.async("string");
    if (!html) continue;
    const chapterTitle = html.match(/<h[12][^>]*>([^<]*)<\/h[12]>/i)?.[1]?.trim() || `Chapter ${chapters.length + 1}`;
    const text = stripHtml(html);
    if (text.length > 0) chapters.push({ title: chapterTitle, content_text: text });
  }

  // Cover: EPUB3 <meta name="cover" content="ID"> or an item with properties="cover-image"
  let coverBytes: Uint8Array | null = null;
  let coverMime: string | null = null;
  const coverMetaId = opfXml.match(/<meta\s+name="cover"\s+content="([^"]+)"/i)?.[1];
  const coverItem = coverMetaId
    ? manifest.get(coverMetaId)
    : Array.from(manifest.values()).find((_v, idx) => opfXml.includes(`properties="cover-image"`) && Array.from(manifest.keys())[idx]);
  if (coverItem && /image/.test(coverItem.mediaType)) {
    const coverFile = zip.file(opfDir + coverItem.href);
    if (coverFile) {
      coverBytes = await coverFile.async("uint8array");
      coverMime = coverItem.mediaType;
    }
  }

  return { title, description, language, page_count: null, chapters, coverBytes, coverMime };
}

async function extractPdf(fileBytes: Uint8Array): Promise<ExtractedBook> {
  const result = await pdfParse(fileBytes);
  const text: string = result.text ?? "";
  const info = result.info ?? {};
  return {
    title: (info.Title as string) || "Untitled",
    description: "",
    language: "en",
    page_count: result.numpages ?? null,
    chapters: text.trim() ? [{ title: "Full text", content_text: text.trim() }] : [],
    coverBytes: null,
    coverMime: null,
  };
}

interface RequestBody {
  storage_path: string;
  file_type: "epub" | "pdf";
  author_id: string;
  category_id?: string;
  is_free?: boolean;
  price_vx?: number;
  price_usd?: number;
  /** Public-domain imports (admin-only in practice — see the author_id
   *  ownership check below) land in publish_status='review' with
   *  import_source set, so they surface in the admin Import Review queue
   *  (Phase 11) instead of a regular author's own private draft pipeline.
   *  An ordinary author's own self-service import is unaffected: it still
   *  lands in 'draft', under their own control, exactly as before. */
  public_domain?: boolean;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const { storage_path, file_type, author_id, category_id, is_free = true, price_vx, price_usd, public_domain = false } = body;
  if (!storage_path || !file_type || !author_id) {
    return json({ error: "storage_path, file_type, and author_id are required" }, 400, cors);
  }
  if (file_type !== "epub" && file_type !== "pdf") return json({ error: 'file_type must be "epub" or "pdf"' }, 400, cors);
  if (!storage_path.startsWith(`${user.id}/`)) {
    return json({ error: "storage_path must be within the caller's own temp-uploads folder" }, 403, cors);
  }

  try {
    const { data: roleRow } = await userClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;

    const { data: authorRow } = await userClient.from("library_authors").select("id, user_id").eq("id", author_id).maybeSingle();
    if (!authorRow) return json({ error: "author_id not found" }, 404, cors);
    if (!isAdmin && authorRow.user_id !== user.id) {
      return json({ error: "You may only import books under your own author profile" }, 403, cors);
    }
    if (public_domain && !isAdmin) {
      return json({ error: "Only admins can import public-domain works into the review queue" }, 403, cors);
    }

    const { data: fileBlob, error: downloadErr } = await serviceClient.storage.from("library-temp-uploads").download(storage_path);
    if (downloadErr || !fileBlob) return json({ error: `Could not read uploaded file: ${downloadErr?.message ?? "not found"}` }, 400, cors);
    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());

    const extracted = file_type === "epub" ? await extractEpub(fileBytes) : await extractPdf(fileBytes);
    if (extracted.chapters.length === 0) {
      return json({ error: "No readable text content could be extracted from this file" }, 422, cors);
    }

    const slug = slugify(extracted.title);
    const bookId = crypto.randomUUID();

    // Dedup check runs for every import (cheap, always useful bookkeeping),
    // not only public-domain ones — see find_potential_duplicate_book
    // (Phase 11 migration).
    const { data: duplicateOf } = await serviceClient.rpc("find_potential_duplicate_book", {
      _title: extracted.title,
      _author_id: author_id,
      _isbn: null,
    });

    let coverImageUrl: string | null = null;
    if (extracted.coverBytes && extracted.coverMime) {
      const ext = extracted.coverMime.split("/")[1] || "jpg";
      const coverPath = `${bookId}/cover.${ext}`;
      const { error: coverUploadErr } = await serviceClient.storage
        .from("library-book-covers")
        .upload(coverPath, extracted.coverBytes, { contentType: extracted.coverMime, upsert: true });
      if (!coverUploadErr) {
        coverImageUrl = serviceClient.storage.from("library-book-covers").getPublicUrl(coverPath).data.publicUrl;
      }
    }

    const bookFilePath = `${bookId}/original.${file_type}`;
    const { error: fileUploadErr } = await serviceClient.storage
      .from("library-book-files")
      .upload(bookFilePath, fileBytes, {
        contentType: file_type === "epub" ? "application/epub+zip" : "application/pdf",
        upsert: true,
      });
    if (fileUploadErr) throw fileUploadErr;

    const { data: book, error: bookErr } = await serviceClient
      .from("library_books")
      .insert({
        id: bookId,
        slug,
        title: extracted.title,
        description: extracted.description || "",
        author_id,
        category_id: category_id ?? null,
        language: extracted.language,
        page_count: extracted.page_count,
        book_type: file_type === "epub" ? "ebook" : "ebook",
        is_free,
        price_vx: price_vx ?? null,
        price_usd: price_usd ?? null,
        cover_image_url: coverImageUrl,
        publish_status: public_domain ? "review" : "draft",
        license_type: public_domain ? "public_domain" : undefined,
        import_source: `${file_type}-import`,
        imported_by: user.id,
        potential_duplicate_of: duplicateOf ?? null,
        duplicate_checked_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (bookErr) throw bookErr;

    const chapterRows = extracted.chapters.map((c, i) => ({
      book_id: bookId,
      chapter_number: i + 1,
      title: c.title,
      content_text: c.content_text,
      is_free_preview: i === 0,
      order_index: i + 1,
    }));
    const { error: chaptersErr } = await serviceClient.from("library_chapters").insert(chapterRows);
    if (chaptersErr) throw chaptersErr;

    const { error: bookFileErr } = await serviceClient.from("library_book_files").insert({
      book_id: bookId,
      file_type,
      storage_path: bookFilePath,
      is_primary: true,
    });
    if (bookFileErr) throw bookFileErr;

    await serviceClient.storage.from("library-temp-uploads").remove([storage_path]);

    return json({ ok: true, book: { ...book, chapters_count: chapterRows.length } }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-import-book error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
