import { useMemo, useState } from "react";
import { ExternalLink, Film, Globe2, Languages, Search, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Layout } from "@/components/Layout";
import { TVSectionNav } from "@/components/tv/TVSectionNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type ProviderCategory = "all" | "arabic" | "international" | "sports";

type Provider = {
  name: string;
  url: string;
  category: Exclude<ProviderCategory, "all">;
  color: string;
  descriptionEn: string;
  descriptionAr: string;
  featuresEn: string[];
  featuresAr: string[];
  hasFreeContent?: boolean;
};

const PROVIDERS: Provider[] = [
  {
    name: "Shahid",
    url: "https://shahid.mbc.net/en",
    category: "arabic",
    color: "from-emerald-500/25 to-emerald-950/50",
    descriptionEn: "Arabic originals, series, movies, kids content, and live TV from MBC.",
    descriptionAr: "أعمال عربية أصلية ومسلسلات وأفلام ومحتوى أطفال وقنوات مباشرة من MBC.",
    featuresEn: ["Arabic-first", "Live TV", "Free and premium content"],
    featuresAr: ["محتوى عربي", "قنوات مباشرة", "محتوى مجاني ومدفوع"],
    hasFreeContent: true,
  },
  {
    name: "OSN+",
    url: "https://osnplus.com/",
    category: "arabic",
    color: "from-fuchsia-500/25 to-purple-950/50",
    descriptionEn: "International, Arabic, and Turkish movies and series, including OSN Originals.",
    descriptionAr: "أفلام ومسلسلات عالمية وعربية وتركية، إضافة إلى أعمال OSN الأصلية.",
    featuresEn: ["Arabic subtitles", "Movies and series", "Offline viewing"],
    featuresAr: ["ترجمة عربية", "أفلام ومسلسلات", "مشاهدة دون اتصال"],
  },
  {
    name: "Netflix",
    url: "https://www.netflix.com/lb-en/",
    category: "international",
    color: "from-red-500/25 to-red-950/50",
    descriptionEn: "Movies, series, documentaries, anime, and a dedicated kids experience.",
    descriptionAr: "أفلام ومسلسلات ووثائقيات وأنمي، مع تجربة منفصلة وآمنة للأطفال.",
    featuresEn: ["Arabic interface", "Audio descriptions on selected titles", "Downloads"],
    featuresAr: ["واجهة عربية", "وصف صوتي في أعمال مختارة", "تنزيل للمشاهدة لاحقاً"],
  },
  {
    name: "Prime Video",
    url: "https://www.primevideo.com/",
    category: "international",
    color: "from-sky-500/25 to-blue-950/50",
    descriptionEn: "Amazon Originals, movies, TV shows, sports, live TV, rentals, and purchases.",
    descriptionAr: "أعمال أمازون الأصلية وأفلام ومسلسلات ورياضة وبث مباشر وخيارات استئجار وشراء.",
    featuresEn: ["Subscriptions", "Rent or buy", "Subtitles and downloads"],
    featuresAr: ["اشتراكات", "استئجار أو شراء", "ترجمة وتنزيل"],
  },
  {
    name: "TOD",
    url: "https://www.tod.tv/en",
    category: "sports",
    color: "from-amber-500/25 to-orange-950/50",
    descriptionEn: "Movies, Arabic and international series, live channels, and major sports from beIN.",
    descriptionAr: "أفلام ومسلسلات عربية وعالمية وقنوات مباشرة وبطولات رياضية من beIN.",
    featuresEn: ["Live sports", "Movies and series", "Arabic and English"],
    featuresAr: ["رياضة مباشرة", "أفلام ومسلسلات", "العربية والإنجليزية"],
  },
  {
    name: "YouTube",
    url: "https://www.youtube.com/feed/storefront",
    category: "international",
    color: "from-rose-500/25 to-slate-950/50",
    descriptionEn: "Official channels plus movies and shows available free, to rent, or to buy by region.",
    descriptionAr: "قنوات رسمية وأفلام وبرامج تتوفر مجاناً أو للاستئجار والشراء حسب البلد.",
    featuresEn: ["Official channels", "Free options", "Captions on supported videos"],
    featuresAr: ["قنوات رسمية", "خيارات مجانية", "نصوص مكتوبة عند توفرها"],
    hasFreeContent: true,
  },
];

const FILTERS: { id: ProviderCategory; en: string; ar: string; icon: typeof Globe2 }[] = [
  { id: "all", en: "All platforms", ar: "كل المنصات", icon: Globe2 },
  { id: "arabic", en: "Arabic", ar: "عربي", icon: Languages },
  { id: "international", en: "International", ar: "عالمي", icon: Film },
  { id: "sports", en: "Sports", ar: "رياضة", icon: Trophy },
];

export default function StreamingGuide() {
  const { dir, lang } = useLanguage();
  const isArabic = lang === "ar";
  const [category, setCategory] = useState<ProviderCategory>("all");
  const [query, setQuery] = useState("");

  const providers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return PROVIDERS.filter((provider) => {
      if (category !== "all" && provider.category !== category) return false;
      if (!normalizedQuery) return true;
      return [
        provider.name,
        provider.descriptionEn,
        provider.descriptionAr,
        ...provider.featuresEn,
        ...provider.featuresAr,
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [category, query]);

  return (
    <Layout>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8" dir={dir} aria-labelledby="streaming-guide-title">
        <section className="overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-slate-950 via-violet-950/80 to-blue-950 p-7 text-white sm:p-9">
          <div className="max-w-3xl space-y-3">
            <Badge className="border-violet-300/30 bg-violet-400/15 text-violet-100">
              <ShieldCheck className="me-1.5 h-4 w-4" aria-hidden="true" />
              {isArabic ? "روابط رسمية وآمنة" : "Official and safe links"}
            </Badge>
            <h1 id="streaming-guide-title" className="text-3xl font-extrabold sm:text-4xl">
              {isArabic ? "أين تشاهد الأفلام والمسلسلات؟" : "Where to watch movies and series"}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-violet-100/80 sm:text-base">
              {isArabic
                ? "دليل مرتب يوصلك إلى المنصات الرسمية مباشرةً. اختر المنصة المناسبة، ثم سجّل الدخول أو اشترك لديها بشكل مستقل."
                : "A curated directory that takes you directly to official streaming platforms. Choose a service, then sign in or subscribe with that provider."}
            </p>
          </div>
        </section>

        <TVSectionNav />

        <section aria-labelledby="platforms-title" className="space-y-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 id="platforms-title" className="text-2xl font-bold">
                {isArabic ? "منصات المشاهدة" : "Streaming platforms"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isArabic
                  ? "قد يختلف المحتوى والسعر حسب بلدك، لذلك يفتح كل زر الموقع الرسمي للمنصة."
                  : "Catalogues and prices vary by country, so every button opens the provider's official website."}
              </p>
            </div>
            <div role="search" className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={isArabic ? "ابحث عن منصة أو ميزة" : "Search platforms or features"}
                aria-label={isArabic ? "البحث في منصات المشاهدة" : "Search streaming platforms"}
                className="ps-9"
              />
            </div>
          </div>

          <div role="group" aria-label={isArabic ? "تصفية المنصات" : "Filter platforms"} className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const Icon = filter.icon;
              const active = category === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(filter.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-violet-500 bg-violet-500 text-white"
                      : "border-border bg-card text-muted-foreground hover:border-violet-400/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {isArabic ? filter.ar : filter.en}
                </button>
              );
            })}
          </div>

          {providers.length === 0 ? (
            <p role="status" className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
              {isArabic ? "لم نجد منصة مطابقة لبحثك." : "No platform matches your search."}
            </p>
          ) : (
            <div role="list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {providers.map((provider) => (
                <article key={provider.name} role="listitem" className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
                  <div className={cn("bg-gradient-to-br p-5", provider.color)}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-2xl font-extrabold">{provider.name}</h3>
                      {provider.hasFreeContent && (
                        <Badge variant="secondary">
                          <Sparkles className="me-1 h-3.5 w-3.5" aria-hidden="true" />
                          {isArabic ? "خيارات مجانية" : "Free options"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {isArabic ? provider.descriptionAr : provider.descriptionEn}
                    </p>
                    <ul className="space-y-2 text-sm">
                      {(isArabic ? provider.featuresAr : provider.featuresEn).map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button asChild className="mt-auto w-full">
                      <a href={provider.url} target="_blank" rel="noopener noreferrer">
                        {isArabic ? `فتح ${provider.name}` : `Open ${provider.name}`}
                        <ExternalLink className="ms-2 h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">
                          {isArabic ? "، يفتح في نافذة جديدة" : ", opens in a new window"}
                        </span>
                      </a>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm leading-6" role="note">
          <strong>{isArabic ? "ملاحظة مهمة: " : "Important: "}</strong>
          {isArabic
            ? "Visionex لا يستضيف الأفلام أو المسلسلات ولا يبيع اشتراكات هذه المنصات. الدليل يعرض روابطها الرسمية فقط، والتوفر يتغير حسب البلد."
            : "Visionex does not host movies or series or sell these subscriptions. This directory only links to official services, and availability varies by country."}
        </aside>
      </main>
    </Layout>
  );
}
