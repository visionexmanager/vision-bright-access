import { TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_TRENDING } from "./mock/mockTrending";

export function TrendingSidebar() {
  const { t } = useLanguage();

  return (
    <div className="net-glass rounded-2xl p-5">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />{t("networkUI.feed.trending")}</p>
      <ul className="flex flex-col gap-2.5">
        {MOCK_TRENDING.map((topic) => (
          <li key={topic.tag} className="flex items-center justify-between text-sm">
            <span className="font-medium text-primary">#{topic.tag}</span>
            <span className="text-xs text-muted-foreground">{topic.postCount.toLocaleString()} {t("networkUI.feed.posts")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
