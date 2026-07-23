import { Link } from "react-router-dom";
import { Library, Heart, BookOpenCheck, Download } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { VXRewardCard } from "@/components/library/VXRewardCard";
import { ReadingGoalsPanel } from "@/components/library/community/ReadingGoalsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyShelf } from "@/hooks/library/useMyShelf";
import { useFavorites } from "@/hooks/library/useFavorites";
import { useContinueReading } from "@/hooks/library/useContinueReading";
import { useDownloads } from "@/hooks/library/useDownloads";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryDashboard() {
  const { t } = useLanguage();
  const { books: shelfBooks } = useMyShelf();
  const { books: favoriteBooks } = useFavorites();
  const { items: continueReadingItems } = useContinueReading();
  const { books: downloadedBooks } = useDownloads();

  const stats = [
    { to: "/library/my-library", label: t("library.nav.myLibrary"), value: shelfBooks.length, icon: Library },
    { to: "/library/favorites", label: t("library.nav.favorites"), value: favoriteBooks.length, icon: Heart },
    { to: "/library/continue-reading", label: t("library.nav.continueReading"), value: continueReadingItems.length, icon: BookOpenCheck },
    { to: "/library/downloads", label: t("library.nav.downloads"), value: downloadedBooks.length, icon: Download },
  ];

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.dashboard")} breadcrumb={[{ label: t("library.nav.dashboard") }]}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map(({ to, label, value, icon: Icon }) => (
            <Link key={to} to={to} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{value}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          <VXRewardCard />
        </div>
        <div className="mt-4">
          <ReadingGoalsPanel />
        </div>
      </LibraryLayout>
    </Layout>
  );
}
