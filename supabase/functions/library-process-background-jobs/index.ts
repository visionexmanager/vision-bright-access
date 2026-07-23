/**
 * library-process-background-jobs — poll-based worker for library_background_jobs
 * (see the "Background jobs queue" section of 20260730000000_library_global_digital_library.sql).
 * Claims a small batch of pending rows, runs each by job_type, and marks it
 * completed/failed. Currently supports:
 *   - "classify_and_index_book": runs the same auto-classification this app's
 *     Studio "Classify with AI" button triggers (topics/subtopics/keywords/
 *     difficulty/reading level + embedding + related-books cache), so a
 *     public-domain import can be auto-organized the moment an admin
 *     approves it, without the importer ever visiting the Studio.
 *   - "organization_scheduled_report": emails an Enterprise Platform org's
 *     scheduled analytics summary to its configured recipients. Sends via
 *     the Resend API directly (same RESEND_API_KEY secret send-email uses)
 *     rather than calling send-email itself, since that function requires
 *     an interactive site-wide-admin user JWT — this worker only has a
 *     service-role client and no end-user session, and org report
 *     recipients are typically organization admins, not site admins.
 *
 * Auth: NOT a user-facing function — there is no end user JWT to check here,
 * since this runs as a system/service process. Deployed with --no-verify-jwt
 * and instead requires header `x-cron-secret` to match the CRON_SECRET env
 * var, so only whoever configured the scheduler can invoke it.
 *
 * IMPORTANT — what this does NOT set up: actually calling this function on a
 * schedule requires a scheduler, e.g. Supabase's built-in Cron Jobs (Dashboard
 * → Database → Cron Jobs) calling this URL with the `x-cron-secret` header,
 * or `pg_cron` + `pg_net` invoking it via `net.http_post`. That's a
 * dashboard/ops configuration step outside this codebase — this migration
 * and function provide the queue and the worker, not the schedule trigger.
 *
 * Input: none required (optional JSON { batch_size })
 * Returns: JSON { ok, processed, failed }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, createEmbedding, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    topics: { type: "array", maxItems: 6, items: { type: "string" } },
    subtopics: { type: "array", maxItems: 10, items: { type: "string" } },
    keywords: { type: "array", maxItems: 15, items: { type: "string" } },
    difficulty_level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    reading_level: { type: "string", enum: ["early_reader", "middle_grade", "young_adult", "adult", "graduate"] },
  },
  required: ["topics", "subtopics", "keywords", "difficulty_level", "reading_level"],
  additionalProperties: false,
};

async function classifyAndIndexBook(serviceClient: ReturnType<typeof createClient>, bookId: string): Promise<void> {
  const { data: book, error: bookErr } = await serviceClient
    .from("library_books")
    .select("id, title, description, description_long, embedding")
    .eq("id", bookId)
    .maybeSingle();
  if (bookErr) throw bookErr;
  if (!book) throw new Error("Book not found");

  const { data: chapters } = await serviceClient
    .from("library_chapters")
    .select("content_text")
    .eq("book_id", bookId)
    .order("order_index", { ascending: true })
    .limit(3);
  const chapterExcerpt = ((chapters ?? []) as Array<{ content_text: string | null }>)
    .map((c) => (c.content_text ?? "").slice(0, 1500))
    .join("\n\n");

  const userText = [
    `Title: ${book.title}`,
    book.description ? `Description: ${book.description}` : "",
    book.description_long ? `Long description: ${book.description_long}` : "",
    chapterExcerpt ? `Opening content excerpt:\n${chapterExcerpt}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 8000);

  const classification = await structuredCompletion({
    provider: "openai",
    model: "gpt-4o-mini",
    system: "You classify a book's subject matter for a digital library catalog. Generate broad topics (high-level subjects), narrower subtopics, searchable keywords, a skill difficulty level, and an age/grade reading level. Base this only on the given text — never invent plot details or facts not implied by it.",
    userText,
    schema: CLASSIFY_SCHEMA,
    toolName: "classify_book",
    maxTokens: 800,
  }) as { topics: string[]; subtopics: string[]; keywords: string[]; difficulty_level: string; reading_level: string };

  await serviceClient.from("library_books").update({
    topics: classification.topics,
    subtopics: classification.subtopics,
    keywords: classification.keywords,
    difficulty_level: classification.difficulty_level,
    reading_level: classification.reading_level,
    auto_classified_at: new Date().toISOString(),
  }).eq("id", bookId);

  let embedding = book.embedding as number[] | null;
  if (!embedding) {
    [embedding] = await createEmbedding([`${book.title}\n${book.description ?? ""}`.slice(0, 2000)]);
    await serviceClient.from("library_books").update({ embedding }).eq("id", bookId);
  }

  if (embedding) {
    const { data: matches } = await serviceClient.rpc("match_library_books_semantic", { _query_embedding: embedding, _match_count: 11 });
    const related = ((matches ?? []) as Array<{ book_id: string; similarity: number }>)
      .filter((m) => m.book_id !== bookId)
      .slice(0, 10);
    if (related.length > 0) {
      await serviceClient.from("library_related_books").delete().eq("book_id", bookId);
      await serviceClient.from("library_related_books").insert(
        related.map((m) => ({ book_id: bookId, related_book_id: m.book_id, similarity: m.similarity }))
      );
    }
  }
}

async function sendOrganizationScheduledReport(serviceClient: ReturnType<typeof createClient>, scheduledReportId: string): Promise<void> {
  const { data: report, error: reportErr } = await serviceClient
    .from("organization_scheduled_reports")
    .select("report_name, recipient_emails, organization_id, organizations(name)")
    .eq("id", scheduledReportId)
    .maybeSingle();
  if (reportErr) throw reportErr;
  if (!report) throw new Error("Scheduled report not found");

  const orgId = report.organization_id as string;
  // deno-lint-ignore no-explicit-any
  const orgName = (report as any).organizations?.name ?? "Your organization";

  const [{ data: stats }, { data: popularBooks }, { data: training }] = await Promise.all([
    serviceClient.rpc("get_organization_reading_stats", { _organization_id: orgId }),
    serviceClient.rpc("get_organization_popular_books", { _organization_id: orgId, _limit: 5 }),
    serviceClient.rpc("get_organization_training_completion", { _organization_id: orgId }),
  ]);
  const s = (stats ?? [])[0] as { total_reading_hours: number; total_books_completed: number; active_member_count: number; avg_completion_rate: number } | undefined;

  const html = `
    <h1>${report.report_name}</h1>
    <p>${orgName} — ${new Date().toLocaleDateString()}</p>
    <h2>Reading Overview</h2>
    <ul>
      <li>Total reading hours: ${s?.total_reading_hours ?? 0}</li>
      <li>Books completed: ${s?.total_books_completed ?? 0}</li>
      <li>Active members: ${s?.active_member_count ?? 0}</li>
      <li>Average completion rate: ${s?.avg_completion_rate ?? 0}%</li>
    </ul>
    <h2>Most Popular Books</h2>
    <ol>${((popularBooks ?? []) as Array<{ title: string; reader_count: number }>).map((b) => `<li>${b.title} (${b.reader_count} readers)</li>`).join("")}</ol>
    <h2>Training Completion</h2>
    <ul>${((training ?? []) as Array<{ title: string; assigned_count: number; completed_count: number }>).map((t) => `<li>${t.title}: ${t.completed_count}/${t.assigned_count} completed</li>`).join("")}</ul>
  `;

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured — scheduled report email cannot be sent");

  const fromAddress = Deno.env.get("RESEND_FROM") || "Visionex <hello@visionex.app>";
  for (const recipient of (report.recipient_emails as string[]) ?? []) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress, to: [recipient], subject: `${report.report_name} — ${orgName}`, html }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("organization_scheduled_report: Resend send error:", err);
    }
  }
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "Unauthorized" }, 401, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let batchSize = 5;
  try {
    const body = await req.json();
    if (typeof body?.batch_size === "number") batchSize = Math.min(Math.max(1, body.batch_size), 20);
  } catch {
    // no body is fine — use the default batch size
  }

  const { data: jobs, error: claimErr } = await serviceClient
    .from("library_background_jobs")
    .select("id, job_type, payload, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (claimErr) return json({ error: claimErr.message }, 500, cors);
  if (!jobs || jobs.length === 0) return json({ ok: true, processed: 0, failed: 0 }, 200, cors);

  const jobIds = jobs.map((j) => j.id as string);
  await serviceClient.from("library_background_jobs").update({ status: "processing" }).in("id", jobIds);

  let processed = 0;
  let failed = 0;
  for (const job of jobs as Array<{ id: string; job_type: string; payload: Record<string, unknown>; attempts: number }>) {
    try {
      switch (job.job_type) {
        case "classify_and_index_book": {
          const bookId = job.payload.book_id;
          if (typeof bookId !== "string") throw new Error("payload.book_id is required");
          await classifyAndIndexBook(serviceClient, bookId);
          break;
        }
        case "organization_scheduled_report": {
          const scheduledReportId = job.payload.scheduled_report_id;
          if (typeof scheduledReportId !== "string") throw new Error("payload.scheduled_report_id is required");
          await sendOrganizationScheduledReport(serviceClient, scheduledReportId);
          break;
        }
        default:
          throw new Error(`Unknown job_type: ${job.job_type}`);
      }
      await serviceClient.from("library_background_jobs").update({ status: "completed", error: null }).eq("id", job.id);
      processed++;
    } catch (err) {
      const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
      await serviceClient.from("library_background_jobs").update({ status: "failed", error: msg, attempts: job.attempts + 1 }).eq("id", job.id);
      failed++;
    }
  }

  return json({ ok: true, processed, failed }, 200, cors);
});
