import { Link } from "react-router-dom";
import { Users, MessageSquare, Calendar, Trophy, Award, UserCircle, Sparkles, ChevronRight } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useClubBrowser } from "@/hooks/library/useClubs";
import { useCommunityRecommendations } from "@/hooks/library/useCommunityAi";
import { useFollowUser } from "@/hooks/library/useFollows";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { LibraryRecommendedFriend } from "@/services/library/communityAi";

const HUB_LINKS = [
  { to: "/library/clubs", icon: Users, labelKey: "library.clubs.title" },
  { to: "/library/events", icon: Calendar, labelKey: "library.events.title" },
  { to: "/library/challenges", icon: Trophy, labelKey: "library.challenge.pageTitle" },
  { to: "/library/leaderboard", icon: Award, labelKey: "library.leaderboard.title" },
];

function FriendRow({ friend }: { friend: LibraryRecommendedFriend }) {
  const { t } = useLanguage();
  const { isFollowing, toggle } = useFollowUser(friend.user_id);
  return (
    <div className="flex items-center gap-3 rounded-md border p-2">
      <Link to={`/library/profile/${friend.user_id}`} className="flex min-w-0 flex-1 items-center gap-2">
        <Avatar className="h-8 w-8"><AvatarImage src={friend.avatar_url ?? undefined} alt="" /><AvatarFallback>{friend.display_name.slice(0, 1)}</AvatarFallback></Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{friend.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">{friend.reason}</p>
        </div>
      </Link>
      <Button size="sm" variant={isFollowing ? "outline" : "default"} className="h-7 shrink-0" onClick={() => void toggle()}>
        {isFollowing ? t("library.profile.unfollow") : t("library.profile.follow")}
      </Button>
    </div>
  );
}

export default function LibraryCommunity() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { myClubs } = useClubBrowser();
  const { clubs: recommendedClubs, friends: recommendedFriends, isLoading: isLoadingRecs } = useCommunityRecommendations();

  useDocumentHead({ title: t("library.nav.community") });

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.community")} breadcrumb={[{ label: t("library.nav.community") }]}>
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {HUB_LINKS.map(({ to, icon: Icon, labelKey }) => (
              <Link key={to} to={to} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                <Card className="flex flex-col items-center gap-2 p-4 text-center transition-shadow hover:shadow-md">
                  <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  <span className="text-sm font-medium">{t(labelKey)}</span>
                </Card>
              </Link>
            ))}
          </div>

          {user && myClubs.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t("library.clubs.myClubs")}</h2>
                <Link to="/library/clubs" className="flex items-center gap-1 text-sm text-primary hover:underline">{t("library.rail.viewAll")} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myClubs.slice(0, 6).map((club) => (
                  <Link key={club.id} to={`/library/clubs/${club.slug}`}>
                    <Card className="p-3 transition-shadow hover:shadow-sm">
                      <p className="font-medium">{club.name}</p>
                      <p className="text-xs text-muted-foreground">{club.member_count} {t("library.clubs.members")}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {user && (
            <section className="grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="mb-3 flex items-center gap-1.5 text-lg font-semibold"><Sparkles className="h-4 w-4 text-primary" aria-hidden="true" /> {t("library.community.recommendedClubs")}</h2>
                {isLoadingRecs ? (
                  <p className="text-sm text-muted-foreground">{t("library.common.loading")}</p>
                ) : recommendedClubs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("library.community.noRecommendationsYet")}</p>
                ) : (
                  <div className="space-y-2">
                    {recommendedClubs.map((club) => (
                      <Link key={club.id} to={`/library/clubs/${club.slug}`}>
                        <Card className="flex items-center justify-between gap-2 p-2.5 transition-shadow hover:shadow-sm">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{club.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{club.reason}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{t("library.clubs.discover")}</Badge>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="mb-3 flex items-center gap-1.5 text-lg font-semibold"><UserCircle className="h-4 w-4 text-primary" aria-hidden="true" /> {t("library.community.recommendedFriends")}</h2>
                {isLoadingRecs ? (
                  <p className="text-sm text-muted-foreground">{t("library.common.loading")}</p>
                ) : recommendedFriends.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("library.community.noRecommendationsYet")}</p>
                ) : (
                  <div className="space-y-2">
                    {recommendedFriends.map((friend) => <FriendRow key={friend.user_id} friend={friend} />)}
                  </div>
                )}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-lg font-semibold"><MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" /> {t("library.community.discussionsHint")}</h2>
            <p className="text-sm text-muted-foreground">{t("library.community.discussionsHintDesc")}</p>
          </section>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
