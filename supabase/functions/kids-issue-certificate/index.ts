/**
 * kids-issue-certificate — VisionKids Academy certificates, extended in
 * Phase 6 (Explorer) with a "master explorer" certificate, and in Phase 8
 * (Live Events) with event participation/winner certificates. Runs
 * entirely on the service-role client (kids_certificates has no
 * INSERT/UPDATE policy for authenticated users — see that migration's
 * comment) so eligibility can only be granted here, after actually
 * checking lesson completion (or, for "explorer", that every world is
 * stamped, or for events, real attendance/medal rows), and so the HMAC
 * signature is computed with a secret the client never has access to.
 * Mirrors library-issue-certificate exactly (same signing scheme, same
 * certificate-number format family).
 *
 * Verification: the public verify_kids_certificate() RPC, or the
 * /kids/academy/certificates/verify/:certificateNumber page.
 *
 * Auth: user-jwt required (issues a certificate to the caller only).
 * Input: JSON { certificate_type: "course" | "learning_path" | "explorer" | "event_participation" | "event_winner" | "talent", reference_id? }
 *        reference_id is required for "course"/"learning_path"/"event_participation"/"event_winner" (an event id for the latter two), ignored for "explorer"/"talent".
 *        "talent" (Phase 9) is issued once the caller has finished a full Talent Academy track OR mastered 5+ skills.
 * Returns: JSON { ok, certificate }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  certificate_type: "course" | "learning_path" | "explorer" | "event_participation" | "event_winner" | "talent";
  reference_id?: string;
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
  if (!body.certificate_type) {
    return json({ error: "certificate_type is required" }, 400, cors);
  }
  if (body.certificate_type !== "explorer" && body.certificate_type !== "talent" && !body.reference_id) {
    return json({ error: "reference_id is required for this certificate_type" }, 400, cors);
  }

  const signingSecret = Deno.env.get("KIDS_CERTIFICATE_SIGNING_SECRET") ?? Deno.env.get("LIBRARY_CERTIFICATE_SIGNING_SECRET");
  if (!signingSecret) {
    console.error("kids-issue-certificate: KIDS_CERTIFICATE_SIGNING_SECRET is not configured");
    return json({ error: "Certificate signing is not configured on this server" }, 500, cors);
  }

  try {
    const { data: profile } = await serviceClient
      .from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
    const recipientName = profile?.display_name || user.email || "VisionKids Learner";

    if (body.certificate_type === "explorer") {
      const { data: existingExplorer } = await serviceClient
        .from("kids_certificates")
        .select("*")
        .eq("user_id", user.id).eq("certificate_type", "explorer")
        .maybeSingle();
      if (existingExplorer) return json({ ok: true, certificate: existingExplorer }, 200, cors);

      const { count: totalWorlds } = await serviceClient
        .from("kids_explorer_worlds").select("*", { count: "exact", head: true })
        .neq("kind", "hub").eq("status", "published");
      const { count: stampCount } = await serviceClient
        .from("kids_explorer_passport_stamps").select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (!totalWorlds || (stampCount ?? 0) < totalWorlds) {
        return json({ error: "Not every world has been explored yet" }, 403, cors);
      }

      const certificateNumber = `VX-KID-${new Date().getFullYear()}-${randomCode(8)}`;
      const verificationCode = randomCode(10);
      const issuedAt = new Date().toISOString();
      const payload = [certificateNumber, user.id, "explorer", "", "VisionKids Explorer — Master Explorer", issuedAt].join("|");
      const signatureHash = await signCertificate(signingSecret, payload);

      const { data: certificate, error: insertErr } = await serviceClient
        .from("kids_certificates")
        .insert({
          user_id: user.id,
          certificate_type: "explorer",
          reference_id: null,
          title: "VisionKids Explorer — Master Explorer",
          recipient_name: recipientName,
          issuer_name: "VisionKids Explorer",
          certificate_number: certificateNumber,
          verification_code: verificationCode,
          signature_hash: signatureHash,
          issued_at: issuedAt,
        })
        .select("*")
        .single();
      if (insertErr) throw insertErr;

      await userClient.rpc("award_kids_xp", { _amount: 100, _reason: "Explorer certificate: master" }).then(() => {}, () => {});
      await userClient.rpc("award_kids_coins", { _amount: 60, _reason: "Explorer certificate: master" }).then(() => {}, () => {});

      return json({ ok: true, certificate }, 200, cors);
    }

    if (body.certificate_type === "talent") {
      const { data: existingTalent } = await serviceClient
        .from("kids_certificates")
        .select("*")
        .eq("user_id", user.id).eq("certificate_type", "talent")
        .maybeSingle();
      if (existingTalent) return json({ ok: true, certificate: existingTalent }, 200, cors);

      // Eligible once a full track is finished OR 5+ skills are mastered.
      const { count: skillsMastered } = await serviceClient
        .from("kids_skill_progress").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("status", "completed");

      const { data: doneRows } = await serviceClient
        .from("kids_track_module_progress").select("track_slug").eq("user_id", user.id);
      const doneByTrack = new Map<string, number>();
      for (const r of doneRows ?? []) doneByTrack.set(r.track_slug, (doneByTrack.get(r.track_slug) ?? 0) + 1);

      let finishedTrack = false;
      for (const [trackSlug, done] of doneByTrack) {
        const { count: total } = await serviceClient
          .from("kids_track_modules").select("*", { count: "exact", head: true })
          .eq("track_slug", trackSlug).eq("status", "published");
        if (total && done >= total) { finishedTrack = true; break; }
      }

      if (!finishedTrack && (skillsMastered ?? 0) < 5) {
        return json({ error: "Finish a full track or master 5 skills first" }, 403, cors);
      }

      const certificateNumber = `VX-KID-${new Date().getFullYear()}-${randomCode(8)}`;
      const verificationCode = randomCode(10);
      const issuedAt = new Date().toISOString();
      const certTitle = "VisionKids Talent Hub — Rising Talent";
      const payload = [certificateNumber, user.id, "talent", "", certTitle, issuedAt].join("|");
      const signatureHash = await signCertificate(signingSecret, payload);

      const { data: certificate, error: insertErr } = await serviceClient
        .from("kids_certificates")
        .insert({
          user_id: user.id,
          certificate_type: "talent",
          reference_id: null,
          title: certTitle,
          recipient_name: recipientName,
          issuer_name: "VisionKids Talent Hub",
          certificate_number: certificateNumber,
          verification_code: verificationCode,
          signature_hash: signatureHash,
          issued_at: issuedAt,
        })
        .select("*").single();
      if (insertErr) throw insertErr;

      await userClient.rpc("award_kids_xp", { _amount: 100, _reason: "Talent certificate: rising talent" }).then(() => {}, () => {});
      await userClient.rpc("award_kids_coins", { _amount: 60, _reason: "Talent certificate: rising talent" }).then(() => {}, () => {});

      return json({ ok: true, certificate }, 200, cors);
    }

    if (body.certificate_type === "event_participation" || body.certificate_type === "event_winner") {
      const { data: existingEventCert } = await serviceClient
        .from("kids_certificates")
        .select("*")
        .eq("user_id", user.id).eq("certificate_type", body.certificate_type).eq("reference_id", body.reference_id!)
        .maybeSingle();
      if (existingEventCert) return json({ ok: true, certificate: existingEventCert }, 200, cors);

      const { data: event, error: eventErr } = await serviceClient
        .from("kids_events").select("id, title").eq("id", body.reference_id).maybeSingle();
      if (eventErr || !event) return json({ error: "Event not found" }, 404, cors);

      if (body.certificate_type === "event_participation") {
        const { data: attendance } = await serviceClient
          .from("kids_event_attendance").select("id").eq("event_id", event.id).eq("user_id", user.id).limit(1);
        if (!attendance || attendance.length === 0) return json({ error: "No attendance record found for this event" }, 403, cors);
      } else {
        const { data: medal } = await serviceClient
          .from("kids_event_medals").select("medal_type").eq("event_id", event.id).eq("user_id", user.id)
          .in("medal_type", ["gold", "silver", "bronze"]).maybeSingle();
        if (!medal) return json({ error: "No winning medal found for this event" }, 403, cors);
      }

      const certificateNumber = `VX-KID-${new Date().getFullYear()}-${randomCode(8)}`;
      const verificationCode = randomCode(10);
      const issuedAt = new Date().toISOString();
      const certTitle = body.certificate_type === "event_winner" ? `${event.title} — Winner` : `${event.title} — Participation`;
      const payload = [certificateNumber, user.id, body.certificate_type, event.id, certTitle, issuedAt].join("|");
      const signatureHash = await signCertificate(signingSecret, payload);

      const { data: certificate, error: insertErr } = await serviceClient
        .from("kids_certificates")
        .insert({
          user_id: user.id,
          certificate_type: body.certificate_type,
          reference_id: event.id,
          title: certTitle,
          recipient_name: recipientName,
          issuer_name: "VisionKids Events",
          certificate_number: certificateNumber,
          verification_code: verificationCode,
          signature_hash: signatureHash,
          issued_at: issuedAt,
        })
        .select("*").single();
      if (insertErr) throw insertErr;

      const xpReason = body.certificate_type === "event_winner" ? "Competition won: " + event.id : "Event certificate: " + event.id;
      const coinsReason = xpReason;
      await userClient.rpc("award_kids_xp", { _amount: body.certificate_type === "event_winner" ? 100 : 40, _reason: xpReason }).then(() => {}, () => {});
      await userClient.rpc("award_kids_coins", { _amount: body.certificate_type === "event_winner" ? 50 : 20, _reason: coinsReason }).then(() => {}, () => {});
      if (body.certificate_type === "event_winner") await userClient.rpc("award_kids_achievement", { _key: "competition_star" }).then(() => {}, () => {});

      return json({ ok: true, certificate }, 200, cors);
    }

    const { data: existing } = await serviceClient
      .from("kids_certificates")
      .select("*")
      .eq("user_id", user.id).eq("certificate_type", body.certificate_type).eq("reference_id", body.reference_id)
      .maybeSingle();
    if (existing) return json({ ok: true, certificate: existing }, 200, cors);

    const { data: course, error: courseErr } = await serviceClient
      .from("kids_courses").select("id, title").eq("id", body.reference_id).maybeSingle();
    if (courseErr || !course) return json({ error: "Course not found" }, 404, cors);

    const { data: publishedLessons } = await serviceClient
      .from("kids_lessons").select("id").eq("course_id", course.id).eq("status", "published");
    const lessonIds = (publishedLessons ?? []).map((l: { id: string }) => l.id);

    if (lessonIds.length === 0) return json({ error: "This course has no lessons yet" }, 403, cors);

    const { data: completedRows } = await serviceClient
      .from("kids_lesson_progress")
      .select("lesson_id")
      .eq("user_id", user.id).eq("status", "completed")
      .in("lesson_id", lessonIds);

    if ((completedRows?.length ?? 0) < lessonIds.length) {
      return json({ error: "Not all lessons in this course are completed yet" }, 403, cors);
    }

    let scorePercent: number | null = null;
    const { data: finalExam } = await serviceClient
      .from("kids_quizzes").select("id").eq("course_id", course.id).maybeSingle();
    if (finalExam) {
      const { data: attempts } = await serviceClient
        .from("kids_quiz_attempts").select("score, total")
        .eq("user_id", user.id).eq("quiz_id", finalExam.id)
        .order("score", { ascending: false }).limit(1);
      const best = attempts?.[0];
      if (!best) return json({ error: "The final exam has not been passed yet" }, 403, cors);
      scorePercent = best.total > 0 ? Math.round((best.score / best.total) * 100) : null;
      if (scorePercent !== null && scorePercent < 60) {
        return json({ error: "The final exam has not been passed yet (60%+ required)" }, 403, cors);
      }
    }

    const certificateNumber = `VX-KID-${new Date().getFullYear()}-${randomCode(8)}`;
    const verificationCode = randomCode(10);
    const issuedAt = new Date().toISOString();
    const payload = [certificateNumber, user.id, body.certificate_type, body.reference_id, course.title, issuedAt].join("|");
    const signatureHash = await signCertificate(signingSecret, payload);

    const { data: certificate, error: insertErr } = await serviceClient
      .from("kids_certificates")
      .insert({
        user_id: user.id,
        certificate_type: body.certificate_type,
        reference_id: body.reference_id,
        title: course.title,
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

    await userClient.rpc("award_kids_xp", { _amount: 50, _reason: `Course completed: ${course.id}` }).then(() => {}, () => {});
    await userClient.rpc("award_kids_coins", { _amount: 30, _reason: `Course completed: ${course.id}` }).then(() => {}, () => {});
    await userClient.rpc("award_kids_achievement", { _key: "first_certificate" }).then(() => {}, () => {});

    return json({ ok: true, certificate }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("kids-issue-certificate error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
