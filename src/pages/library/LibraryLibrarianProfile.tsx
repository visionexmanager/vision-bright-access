import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpenCheck, BookOpen, Bookmark, Highlighter, StickyNote, Heart, Waypoints,
  GraduationCap, Award, FolderKanban, Sparkles, Plus, X,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/library/EmptyState";
import { Loader2 } from "lucide-react";
import { useLibrarianProfile } from "@/hooks/library/useLibrarianProfile";
import type { LibrarySkillLevel } from "@/services/library/librarianSkills";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></div>
      <div>
        <p className="text-xl font-semibold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

const SKILL_LEVELS: LibrarySkillLevel[] = ["beginner", "intermediate", "advanced", "expert"];

export default function LibraryLibrarianProfile() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const {
    readingHistory, engagement, favorites, favoriteTopics, courses, certificates, researchProjects, skills,
    isLoading, toggleFavoriteTopic, createSkill, setSkillLevel, deleteSkill,
  } = useLibrarianProfile();
  const [newSkill, setNewSkill] = useState("");

  useDocumentHead({ title: t("library.librarian.profile.title") });

  return (
    <Layout>
      <LibraryLayout title={t("library.librarian.profile.title")} breadcrumb={[{ label: t("library.librarian.title"), to: "/library/librarian" }, { label: t("library.librarian.profile.title") }]}>
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t("library.librarian.profile.readingHistory")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={BookOpenCheck} label={t("library.librarian.profile.completedBooks")} value={readingHistory?.completedCount ?? 0} />
              <StatCard icon={BookOpen} label={t("library.librarian.profile.incompleteBooks")} value={readingHistory?.incompleteCount ?? 0} />
              <StatCard icon={Sparkles} label={t("library.librarian.profile.listeningDays")} value={readingHistory?.listeningCount ?? 0} />
              <StatCard icon={Bookmark} label={t("library.librarian.profile.bookmarks")} value={engagement?.bookmarksCount ?? 0} />
              <StatCard icon={Highlighter} label={t("library.librarian.profile.highlights")} value={engagement?.highlightsCount ?? 0} />
              <StatCard icon={StickyNote} label={t("library.librarian.profile.notes")} value={engagement?.notesCount ?? 0} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t("library.librarian.profile.favorites")}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Heart className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.profile.favoriteGenres")}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(favorites?.favoriteGenres ?? []).length === 0
                    ? <p className="text-xs text-muted-foreground">{t("library.librarian.profile.noneYet")}</p>
                    : favorites!.favoriteGenres.map((g) => <Badge key={g.id} variant="secondary">{g.name}</Badge>)}
                </div>
              </Card>
              <Card className="p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Heart className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.profile.favoriteAuthors")}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(favorites?.favoriteAuthors ?? []).length === 0
                    ? <p className="text-xs text-muted-foreground">{t("library.librarian.profile.noneYet")}</p>
                    : favorites!.favoriteAuthors.map((a) => <Badge key={a.id} variant="secondary">{a.name}</Badge>)}
                </div>
              </Card>
              <Card className="p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Heart className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.profile.languages")}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(favorites?.languages ?? []).length === 0
                    ? <p className="text-xs text-muted-foreground">{t("library.librarian.profile.noneYet")}</p>
                    : favorites!.languages.map((lang) => <Badge key={lang} variant="secondary">{lang}</Badge>)}
                </div>
              </Card>
            </div>
            {user && (
              <p className="mt-2 text-xs text-muted-foreground">
                <Link to={`/library/profile/${user.id}`} className="hover:underline">{t("library.librarian.profile.editFavoritesHint")}</Link>
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><Waypoints className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.profile.favoriteTopics")}</h2>
            {favoriteTopics.length === 0 ? (
              <EmptyState icon={<Waypoints className="h-8 w-8" />} title={t("library.librarian.profile.noFavoriteTopics")} className="py-6" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {favoriteTopics.map((topic) => (
                  <Badge key={topic.entity_id} variant="secondary" className="gap-1 pe-1">
                    <Link to={`/library/knowledge-graph/${topic.slug}`} className="hover:underline">{topic.name}</Link>
                    <Button type="button" variant="ghost" size="icon" className="h-4 w-4" onClick={() => void toggleFavoriteTopic(topic.entity_id, true)} aria-label={t("library.researchAssistant.remove")}>
                      <X className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><Award className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.profile.skills")}</h2>
            <div className="mb-3 flex gap-2">
              <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder={t("library.librarian.profile.addSkillPlaceholder")} className="max-w-xs" />
              <Button size="sm" variant="outline" className="gap-1.5" disabled={!newSkill.trim()} onClick={() => { void createSkill(newSkill); setNewSkill(""); }}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.librarian.profile.addSkill")}
              </Button>
            </div>
            {skills.length === 0 ? (
              <EmptyState icon={<Award className="h-8 w-8" />} title={t("library.librarian.profile.noSkills")} className="py-6" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {skills.map((skill) => (
                  <Card key={skill.id} className="flex items-center justify-between gap-2 p-3">
                    <span className="text-sm font-medium">{skill.skill_name}</span>
                    <div className="flex items-center gap-1.5">
                      <Select value={skill.proficiency_level} onValueChange={(v) => void setSkillLevel(skill.id, v as LibrarySkillLevel)}>
                        <SelectTrigger className="h-8 w-32" aria-label={t("library.librarian.profile.skillLevel")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SKILL_LEVELS.map((lvl) => <SelectItem key={lvl} value={lvl}>{t(`library.librarian.profile.skillLevel.${lvl}`)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void deleteSkill(skill.id)} aria-label={t("library.reviews.delete")}>
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><GraduationCap className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.profile.courses")}</h2>
              {courses.length === 0 ? (
                <EmptyState icon={<GraduationCap className="h-8 w-8" />} title={t("library.librarian.profile.noCourses")} className="py-6" />
              ) : (
                <ul className="space-y-2">
                  {courses.map((c) => (
                    <li key={c.course_id}>
                      <Card className="p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{c.title}</p>
                          {c.completed_at && <Badge variant="secondary" className="text-xs">{t("library.librarian.profile.completed")}</Badge>}
                        </div>
                        <Progress value={c.progress_percent} className="h-1.5" />
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><Award className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.profile.certificates")}</h2>
              {certificates.length === 0 ? (
                <EmptyState icon={<Award className="h-8 w-8" />} title={t("library.librarian.profile.noCertificates")} className="py-6" />
              ) : (
                <ul className="space-y-2">
                  {certificates.map((cert) => (
                    <li key={cert.id}>
                      <Card className="flex items-center justify-between gap-2 p-3">
                        <span className="text-sm font-medium">{cert.title}</span>
                        <Badge variant="outline" className="text-xs">{t(`library.librarian.profile.certificateType.${cert.certificate_type}`)}</Badge>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><FolderKanban className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.profile.researchProjects")}</h2>
            {researchProjects.length === 0 ? (
              <EmptyState icon={<FolderKanban className="h-8 w-8" />} title={t("library.librarian.profile.noResearchProjects")} className="py-6" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {researchProjects.map((p) => (
                  <Link key={p.id} to={`/library/research-projects/${p.id}`}>
                    <Badge variant="secondary">{p.title}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {isLoading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>}
        </div>
      </LibraryLayout>
    </Layout>
  );
}
