/**
 * library-issue-certificate — Learning Hub certificates. Runs entirely on
 * the service-role client (library_certificates has no INSERT/UPDATE policy
 * for authenticated users at all — see the migration comment) so eligibility
 * can only be granted here, after actually checking the underlying
 * completion record, and so the HMAC signature is computed with a secret
 * the client never has access to.
 *
 * Verification is via the public verify_library_certificate() RPC, or the
 * /library/certificates/verify/:certificateNumber page in the app, which
 * reads that RPC.
 *
 * Auth: user-jwt required (issues a certificate to the caller only).
 * Input: JSON { certificate_type, reference_id }
 * Returns: JSON { ok, certificate } (full library_certificates row)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  certificate_type: "learning_path" | "course" | "exam" | "reading_challenge" | "skill_mastery" | "organization_assignment";
  reference_id: string;
}

function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, length).toUpperCase();
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signCertificate(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.certificate_type || !body.reference_id) {
    return json({ error: "certificate_type and reference_id are required" }, 400, cors);
  }

  const signingSecret = Deno.env.get("LIBRARY_CERTIFICATE_SIGNING_SECRET");
  if (!signingSecret) {
    console.error("library-issue-certificate: LIBRARY_CERTIFICATE_SIGNING_SECRET is not configured");
    return json({ error: "Certificate signing is not configured on this server" }, 500, cors);
  }

  try {
    const { data: profile } = await serviceClient
      .from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
    const recipientName = profile?.display_name || user.email || "Visionex Learner";

    let title: string | null = null;
    let scorePercent: number | null = null;

    if (body.certificate_type === "learning_path") {
      const { data: enrollment } = await serviceClient
        .from("library_learning_path_enrollments")
        .select("completed_at, library_learning_paths(title)")
        .eq("user_id", user.id).eq("path_id", body.reference_id).maybeSingle();
      if (!enrollment?.completed_at) return json({ error: "Learning path not yet completed" }, 403, cors);
      // deno-lint-ignore no-explicit-any
      title = (enrollment as any).library_learning_paths?.title ?? "Learning Path";
    } else if (body.certificate_type === "course") {
      const { data: enrollment } = await serviceClient
        .from("academy_enrollments")
        .select("completed_at, academy_courses(title)")
        .eq("user_id", user.id).eq("course_id", body.reference_id).maybeSingle();
      if (!enrollment?.completed_at) return json({ error: "Course not yet completed" }, 403, cors);
      // deno-lint-ignore no-explicit-any
      title = (enrollment as any).academy_courses?.title ?? "Course";
    } else if (body.certificate_type === "exam") {
      const { data: attempt } = await serviceClient
        .from("library_quiz_attempts")
        .select("score_percent, passed, library_quizzes(title, is_timed)")
        .eq("user_id", user.id).eq("quiz_id", body.reference_id)
        .eq("passed", true).order("score_percent", { ascending: false }).limit(1).maybeSingle();
      // deno-lint-ignore no-explicit-any
      const quiz = (attempt as any)?.library_quizzes;
      if (!attempt || !quiz?.is_timed) return json({ error: "No passed exam attempt found" }, 403, cors);
      title = quiz.title ?? "Exam";
      scorePercent = attempt.score_percent;
    } else if (body.certificate_type === "reading_challenge") {
      const { data: progress } = await serviceClient
        .from("library_challenge_progress")
        .select("completed_at, library_challenges(title)")
        .eq("user_id", user.id).eq("challenge_id", body.reference_id).maybeSingle();
      if (!progress?.completed_at) return json({ error: "Challenge not yet completed" }, 403, cors);
      // deno-lint-ignore no-explicit-any
      title = (progress as any).library_challenges?.title ?? "Reading Challenge";
    } else if (body.certificate_type === "skill_mastery") {
      const { data: book } = await serviceClient
        .from("library_books").select("title").eq("id", body.reference_id).maybeSingle();
      if (!book) return json({ error: "Book not found" }, 404, cors);
      const { data: masteryAttempts } = await serviceClient
        .from("library_quiz_attempts")
        .select("score_percent, library_quizzes!inner(book_id)")
        .eq("user_id", user.id).eq("passed", true).gte("score_percent", 90)
        .eq("library_quizzes.book_id", body.reference_id).limit(1);
      if (!masteryAttempts || masteryAttempts.length === 0) {
        return json({ error: "No mastery-level (90%+) quiz result found for this book" }, 403, cors);
      }
      title = book.title;
      scorePercent = masteryAttempts[0].score_percent;
    } else if (body.certificate_type === "organization_assignment") {
      const { data: completion } = await serviceClient
        .from("organization_assignment_completions")
        .select("completed_at, score_percent, organization_assignments(title)")
        .eq("user_id", user.id).eq("assignment_id", body.reference_id).maybeSingle();
      // deno-lint-ignore no-explicit-any
      const assignment = (completion as any)?.organization_assignments;
      if (!completion?.completed_at) return json({ error: "Assignment not yet completed" }, 403, cors);
      title = assignment?.title ?? "Organization Assignment";
      scorePercent = completion.score_percent;
    } else {
      return json({ error: "Invalid certificate_type" }, 400, cors);
    }

    const certificateNumber = `VX-LIB-${new Date().getFullYear()}-${randomCode(8)}`;
    const verificationCode = randomCode(10);
    const issuedAt = new Date().toISOString();
    const payload = [certificateNumber, user.id, body.certificate_type, body.reference_id, title, issuedAt].join("|");
    const signatureHash = await signCertificate(signingSecret, payload);

    const { data: certificate, error: insertErr } = await serviceClient
      .from("library_certificates")
      .insert({
        user_id: user.id,
        certificate_type: body.certificate_type,
        reference_id: body.reference_id,
        title,
        recipient_name: recipientName,
        score_percent: scorePercent,
        certificate_number: certificateNumber,
        verification_code: verificationCode,
        signature_hash: signatureHash,
        issued_at: issuedAt,
      })
      .select("*")
      .single();
    if (insertErr) throw insertErr;

    await userClient.rpc("award_library_xp", { _amount: 40, _reason: `Certificate earned:${certificate.id}` }).then(
      () => {},
      () => {}, // non-fatal if the XP grant races/fails
    );

    return json({ ok: true, certificate }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-issue-certificate error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
