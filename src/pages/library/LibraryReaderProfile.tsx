import type { ElementType, ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, BookMarked, Heart, Star, Users, UserPlus, Award, Lock } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { EditReaderProfileDialog } from "@/components/library/community/EditReaderProfileDialog";
import { ReportContentDialog } from "@/components/library/ReportContentDialog";
import { useReaderProfile } from "@/hooks/library/useReaderProfile";
import { useFollowUser, useFollowLists } from "@/hooks/library/useFollows";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { fetchCategories } from "@/services/library/catalog";
import { fetchAuthors } from "@/services/library/authors";

function StatBlock({ icon: Icon, value, label }: { icon: ElementType; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-lg font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function FollowListDialog({ title, users, trigger }: { title: string; users: { userId: string; displayName: string; avatarUrl: string | null }[]; trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {users.map((u) => (
              <li key={u.userId}>
                <Link to={`/library/profile/${u.userId}`} className="flex items-center gap-2 rounded-md p-1.5 hover:bg-muted">
                  <Avatar className="h-7 w-7"><AvatarImage src={u.avatarUrl ?? undefined} alt="" /><AvatarFallback>{u.displayName.slice(0, 1)}</AvatarFallback></Avatar>
                  <span className="text-sm">{u.displayName}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function LibraryReaderProfile() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { userId } = useParams<{ userId: string }>();
  const { profile, stats, publicLists, earnedAchievements, reviews, isSelf, isLoading, saveProfile } = useReaderProfile(userId);
  const { isFollowing, toggle: toggleFollow } = useFollowUser(userId);
  const { followers, following } = useFollowLists(userId);

  const { data: categories = [] } = useQuery({ queryKey: ["library", "categories-for-profile"], queryFn: fetchCategories, staleTime: 60 * 60 * 1000 });
  const { data: authors = [] } = useQuery({ queryKey: ["library", "authors-for-profile"], queryFn: fetchAuthors, staleTime: 60 * 60 * 1000 });

  useDocumentHead({ title: profile ? `${profile.displayName} — ${t("library.profile.title")}` : t("library.profile.title") });

  const genreNames = (profile?.favorite_genres ?? []).map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean) as string[];
  const authorNames = (profile?.favorite_authors ?? []).map((id) => authors.find((a) => a.id === id)?.name).filter(Boolean) as string[];

  return (
    <Layout>
      <LibraryLayout title={profile?.displayName ?? t("library.profile.title")} breadcrumb={profile ? [{ label: profile.displayName }] : []}>
        {isLoading ? (
          <SkeletonLoader variant="detail" />
        ) : !profile ? (
          <EmptyState icon={<Lock className="h-10 w-10" />} title={t("library.profile.notFoundOrPrivate")} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="text-lg">{profile.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold">{profile.displayName}</h2>
                  {profile.bio && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{profile.bio}</p>}
                </div>
              </div>
              {isSelf ? (
                <EditReaderProfileDialog profile={profile} categories={categories} authors={authors} onSave={saveProfile} />
              ) : user ? (
                <div className="flex gap-2">
                  <Button size="sm" variant={isFollowing ? "outline" : "default"} className="gap-1.5" onClick={() => void toggleFollow()}>
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> {isFollowing ? t("library.profile.unfollow") : t("library.profile.follow")}
                  </Button>
                  <ReportContentDialog contentType="library_reader_profile" contentId={profile.user_id} iconOnly />
                </div>
              ) : null}
            </div>

            {(genreNames.length > 0 || authorNames.length > 0 || profile.languages.length > 0) && (
              <div className="flex flex-wrap gap-4 text-sm">
                {genreNames.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{t("library.profile.favoriteGenres")}:</span>
                    {genreNames.map((n) => <Badge key={n} variant="secondary">{n}</Badge>)}
                  </div>
                )}
                {authorNames.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{t("library.profile.favoriteAuthors")}:</span>
                    {authorNames.map((n) => <Badge key={n} variant="outline">{n}</Badge>)}
                  </div>
                )}
                {profile.languages.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{t("library.profile.languages")}:</span>
                    {profile.languages.map((code) => <Badge key={code} variant="outline">{t(`library.language.${code}`)}</Badge>)}
                  </div>
                )}
              </div>
            )}

            {stats && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                <StatBlock icon={BookOpen} value={stats.booksReadCount} label={t("library.profile.booksRead")} />
                <StatBlock icon={BookMarked} value={stats.booksReadingCount} label={t("library.profile.booksReading")} />
                <StatBlock icon={Heart} value={stats.wishlistCount} label={t("library.profile.wishlist")} />
                <StatBlock icon={Star} value={stats.reviewsCount} label={t("library.nav.reviews")} />
                <FollowListDialog
                  title={t("library.profile.followers")}
                  users={followers}
                  trigger={<button type="button"><StatBlock icon={Users} value={stats.followersCount} label={t("library.profile.followers")} /></button>}
                />
                <FollowListDialog
                  title={t("library.profile.following")}
                  users={following}
                  trigger={<button type="button"><StatBlock icon={Users} value={stats.followingCount} label={t("library.profile.following")} /></button>}
                />
              </div>
            )}

            {earnedAchievements.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Award className="h-4 w-4" aria-hidden="true" /> {t("library.profile.achievements")}</h2>
                <div className="flex flex-wrap gap-2">
                  {earnedAchievements.map((a) => (
                    <Badge key={a.id} variant="secondary" className="gap-1 py-1.5">{a.name}</Badge>
                  ))}
                </div>
              </section>
            )}

            {publicLists.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold">{t("library.profile.publicReadingLists")}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {publicLists.map((list) => (
                    <Card key={list.id} className="p-3">
                      <p className="font-medium">{list.name}</p>
                      {list.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{list.description}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">{t("library.profile.booksInList").replace("{count}", String(list.bookCount))}</p>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {reviews.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold">{t("library.nav.reviews")}</h2>
                <div className="space-y-2">
                  {reviews.slice(0, 5).map((r) => (
                    <Card key={r.id} className="p-3 text-sm">
                      <p className="font-medium">{"★".repeat(r.rating)}</p>
                      {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
