import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, UserPlus, X } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ivxGuardians,
  MASTERY_LABEL,
  type IvxGuardianLink,
  type IvxGuardianProgress,
  type IvxGuardianRelation,
  type IvxWatchedStudent,
} from "@/features/ivx/api";

/**
 * Parents, teachers, and the student who decides.
 *
 * ── Why one page for both roles ─────────────────────────────────────────────
 *
 * A person is often both: a teacher who is also learning, a parent following
 * two children while working through the accessibility track themselves. Two
 * pages would mean picking which one you are, and being wrong.
 *
 * ── The direction of consent, in the interface ──────────────────────────────
 *
 * The student's half comes first and generates codes. The guardian's half only
 * ever *enters* one. There is no field here for looking somebody up, because
 * there is no function behind it: `ivx_guardian_accept` is the only way a link
 * begins, and it needs a code the student chose to hand over.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 *
 * A new invite code is announced assertively — it is the thing the student
 * asked for, they are about to read it out, and it expires. Everything else
 * is polite. The code is rendered with a wide letter-spacing and repeated
 * character by character for a screen reader, because "read this code down
 * the phone" is exactly when a run-together string of capitals fails.
 */
export default function IVXGuardians() {
  const { translateText, dir, lang } = useLanguage();
  const language = lang === "ar" ? "ar" : lang;

  const [links, setLinks] = useState<IvxGuardianLink[]>([]);
  const [students, setStudents] = useState<IvxWatchedStudent[]>([]);
  const [relation, setRelation] = useState<IvxGuardianRelation>("parent");
  const [label, setLabel] = useState("");
  const [freshCode, setFreshCode] = useState<string | null>(null);
  const [codeEntry, setCodeEntry] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [viewing, setViewing] = useState<IvxGuardianProgress | null>(null);

  const refresh = useCallback(async () => {
    const [mine, watched] = await Promise.all([
      ivxGuardians.links(),
      ivxGuardians.students(),
    ]);
    if (!mine.ok && (mine as { reason: string }).reason === "not_authenticated") {
      setSignedOut(true);
      return;
    }
    if (mine.ok) setLinks((mine as { links: IvxGuardianLink[] }).links);
    if (watched.ok) setStudents((watched as { students: IvxWatchedStudent[] }).students);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const invite = async () => {
    const made = await ivxGuardians.invite(relation, label.trim());
    if (made.ok) {
      setFreshCode((made as { code: string }).code);
      setLabel("");
      setNotice(null);
      await refresh();
      return;
    }
    const reason = (made as { reason: string }).reason;
    setFreshCode(null);
    setNotice(
      reason === "too_many_pending"
        ? translateText("You already have five invitations waiting. Cancel one before making another.")
        : translateText("That did not work. Please try again shortly."),
    );
  };

  const accept = async () => {
    const done = await ivxGuardians.accept(codeEntry.trim());
    if (done.ok) {
      setCodeEntry("");
      setNotice(
        (done as { already: boolean }).already
          ? translateText("You already follow this student.")
          : translateText("Linked. Their practice is below."),
      );
      await refresh();
      return;
    }
    setNotice(
      (done as { reason: string }).reason === "invalid_code"
        ? translateText("That code is not valid, or it has expired. Ask for a new one.")
        : translateText("That did not work. Please try again shortly."),
    );
  };

  const revoke = async (id: string) => {
    await ivxGuardians.revoke(id);
    setViewing(null);
    await refresh();
  };

  const view = async (studentId: string) => {
    const got = await ivxGuardians.progress(studentId, language);
    setViewing(got.ok ? (got as IvxGuardianProgress) : null);
  };

  if (signedOut) {
    return (
      <Layout>
        <main className="mx-auto max-w-2xl px-4 py-10" dir={dir}>
          <h1 className="text-2xl font-bold">{translateText("Parents and teachers")}</h1>
          <p className="mt-4" role="status">
            {translateText("Sign in to invite somebody, or to follow a student who invited you.")}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/academy/ivx">{translateText("Back to IVX")}</Link>
          </Button>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="mx-auto max-w-3xl px-4 py-10" dir={dir}>
        <p className="text-sm text-muted-foreground">
          <Link to="/academy/ivx" className="underline">IVX</Link>
        </p>
        <h1 className="mt-1 text-2xl font-bold">{translateText("Parents and teachers")}</h1>
        <p className="mt-2 text-muted-foreground">
          {translateText(
            "Nobody can follow your practice unless you invite them. They see how you are doing — never what you typed, and never your conversations with the tutor.",
          )}
        </p>

        {notice && (
          <p className="mt-4 rounded-lg bg-muted p-3 text-sm" role="status">{notice}</p>
        )}

        {/* ── The student's half ─────────────────────────────────────────── */}
        <section className="mt-8" aria-labelledby="ivx-invite-heading">
          <h2 id="ivx-invite-heading" className="text-lg font-bold">
            {translateText("Invite someone to follow my progress")}
          </h2>

          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => { event.preventDefault(); void invite(); }}
          >
            <div>
              <label htmlFor="ivx-relation" className="block text-sm font-medium">
                {translateText("They are my")}
              </label>
              <select
                id="ivx-relation"
                value={relation}
                onChange={(event) => setRelation(event.target.value as IvxGuardianRelation)}
                className="mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="parent">{translateText("Parent or guardian")}</option>
                <option value="teacher">{translateText("Teacher")}</option>
              </select>
            </div>

            <div className="flex-1">
              <label htmlFor="ivx-label" className="block text-sm font-medium">
                {translateText("What shall I call this link?")}
              </label>
              <Input
                id="ivx-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={60}
                autoComplete="off"
                className="mt-1"
                placeholder={translateText("Mum, Ms Haddad …")}
              />
            </div>

            <Button type="submit">
              <UserPlus className="me-2 h-4 w-4" aria-hidden="true" />
              {translateText("Create a code")}
            </Button>
          </form>

          {/* Assertive: this is the thing that was just asked for, it is about
              to be read out loud, and it stops working in seven days. */}
          <div aria-live="assertive" className="mt-4">
            {freshCode && (
              <div className="rounded-xl border border-border p-4">
                <p className="text-sm">
                  {translateText("Give them this code. It works once, and for seven days.")}
                </p>
                <p className="mt-2 font-mono text-2xl tracking-[0.3em]" aria-hidden="true">{freshCode}</p>
                {/* Letter by letter, because a run of capitals is read as a
                    word by some screen readers and as nothing by others. */}
                <p className="sr-only">
                  {`${translateText("The code is")}: ${freshCode.split("").join(" ")}`}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void navigator.clipboard?.writeText(freshCode)}
                >
                  <Copy className="me-2 h-4 w-4" aria-hidden="true" />
                  {translateText("Copy the code")}
                </Button>
              </div>
            )}
          </div>

          <h3 className="mt-6 text-base font-bold">
            {translateText("Who can see my progress")}
          </h3>
          {links.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {translateText("Nobody yet.")}
            </p>
          ) : (
            <ul className="mt-2 space-y-2" role="list">
              {links.map((link) => (
                <li key={link.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                  <span className="flex-1 text-sm">
                    <strong>{link.guardian_name || link.label || translateText("Waiting to be used")}</strong>
                    {" — "}
                    {link.relation === "teacher" ? translateText("Teacher") : translateText("Parent or guardian")}
                    {link.status === "pending" && link.code && (
                      <>
                        {" · "}
                        <span className="font-mono" aria-hidden="true">{link.code}</span>
                        <span className="sr-only">
                          {`${translateText("code")} ${link.code.split("").join(" ")}`}
                        </span>
                      </>
                    )}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void revoke(link.id)}>
                    <X className="me-2 h-4 w-4" aria-hidden="true" />
                    {link.status === "pending" ? translateText("Cancel") : translateText("Stop sharing")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── The guardian's half ────────────────────────────────────────── */}
        <section className="mt-10" aria-labelledby="ivx-follow-heading">
          <h2 id="ivx-follow-heading" className="text-lg font-bold">
            {translateText("Follow a student")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {translateText("Enter the code the student gave you. There is no other way to follow somebody.")}
          </p>

          <form
            className="mt-3 flex flex-wrap gap-3"
            onSubmit={(event) => { event.preventDefault(); void accept(); }}
          >
            <label htmlFor="ivx-code" className="sr-only">{translateText("Invitation code")}</label>
            <Input
              id="ivx-code"
              value={codeEntry}
              onChange={(event) => setCodeEntry(event.target.value)}
              autoComplete="off"
              maxLength={20}
              className="flex-1 font-mono"
              placeholder={translateText("Invitation code")}
            />
            <Button type="submit" disabled={!codeEntry.trim()}>{translateText("Follow")}</Button>
          </form>

          {students.length > 0 && (
            <ul className="mt-5 space-y-2" role="list">
              {students.map((student) => (
                <li key={student.link_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                  <span className="flex-1 text-sm">
                    <strong>{student.name || translateText("Student")}</strong>
                    {` — ${translateText("XP")} ${student.xp} · ${translateText("Streak")} ${student.streak_days}`}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void view(student.student_id)}>
                    {translateText("See their practice")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void revoke(student.link_id)}>
                    {translateText("Stop following")}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div aria-live="polite" className="mt-6">
            {viewing && (
              <article className="rounded-xl border border-border p-5" aria-labelledby="ivx-student-heading">
                <h3 id="ivx-student-heading" className="text-lg font-bold">
                  {viewing.name || translateText("Student")}
                </h3>

                {/* A sentence first. A parent who is told "42 attempts, 30
                    correct, last practised Tuesday" knows what to say at
                    dinner; a chart does not travel to that conversation. */}
                <p className="mt-2">
                  {`${translateText("In the last 30 days")}: ${viewing.attempts_30d} ${translateText("questions")}, ${viewing.correct_30d} ${translateText("correct")}.`}
                  {viewing.last_practised_at && (
                    ` ${translateText("Last practised")} ${new Date(viewing.last_practised_at).toLocaleDateString(lang)}.`
                  )}
                </p>

                {viewing.struggling.length > 0 && (
                  <>
                    <h4 className="mt-4 font-bold">{translateText("Where help would land")}</h4>
                    <ul className="mt-2 space-y-1 text-sm" role="list">
                      {viewing.struggling.map((skill) => (
                        <li key={skill.skill}>
                          {skill.title}
                          {" — "}
                          {lang === "ar" ? MASTERY_LABEL[skill.state].ar : MASTERY_LABEL[skill.state].en}
                          {`, ${skill.correct}/${skill.attempts} ${translateText("correct")}`}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {viewing.mastered.length > 0 && (
                  <>
                    <h4 className="mt-4 font-bold">{translateText("Mastered")}</h4>
                    <ul className="mt-2 space-y-1 text-sm" role="list">
                      {viewing.mastered.slice(0, 10).map((skill) => (
                        <li key={skill.skill}>{skill.title}</li>
                      ))}
                    </ul>
                  </>
                )}

                <p className="mt-4 text-sm text-muted-foreground">
                  {translateText(
                    "You are seeing progress only. What they typed, and anything they asked the tutor, stays with them.",
                  )}
                </p>
              </article>
            )}
          </div>
        </section>
      </main>
    </Layout>
  );
}
