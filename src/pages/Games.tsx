import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Search, Filter } from "lucide-react";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import gamesImg from "@/assets/games-illustration.jpg";
import quizImg from "@/assets/game-quiz.jpg";
import memoryImg from "@/assets/game-memory.jpg";
import wordImg from "@/assets/game-word.jpg";
import hangmanImg from "@/assets/game-hangman.jpg";
import jungleImg from "@/assets/game-jungle.jpg";
import starchefImg from "@/assets/game-starchef.jpg";
import unoImg from "@/assets/game-uno.jpg";
import neonbreachImg from "@/assets/game-neonbreach.jpg";
import logiquestImg from "@/assets/game-logiquest.jpg";
import tradetycoonImg from "@/assets/game-tradetycoon.jpg";
import tacticalImg from "@/assets/game-tactical.jpg";
import dominoesImg from "@/assets/game-dominoes.jpg";
import farkleImg from "@/assets/game-farkle.jpg";
import briscolaImg from "@/assets/game-briscola.jpg";
import card99Img from "@/assets/game-card99.jpg";
import dreamhomeImg from "@/assets/game-dreamhome.jpg";
import laptoptechImg from "@/assets/game-laptoptech.jpg";
import earmasterImg from "@/assets/game-earmaster.jpg";
import fashionImg from "@/assets/game-fashion.jpg";
import velocityImg from "@/assets/game-velocity.jpg";

type Category = "All" | "Quiz" | "Memory" | "Word" | "Adventure" | "Cooking" | "Cards" | "Cyber" | "Logic" | "Trading" | "Action" | "Classic" | "Dice" | "Tech" | "Music" | "Creative" | "Racing" | "Design";

export default function Games() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const games = useMemo(() => [
    { to: "/games/quiz-challenge", img: quizImg, title: t("games.quiz.title"), desc: t("games.quiz.desc"), badge: t("games.quiz.badge"), category: "Quiz" as Category },
    { to: "/games/memory", img: memoryImg, title: t("games.memory.title"), desc: t("games.memory.desc"), badge: t("games.memory.badge"), category: "Memory" as Category },
    { to: "/games/word-puzzle", img: wordImg, title: t("games.word.title"), desc: t("games.word.desc"), badge: t("games.word.badge"), category: "Word" as Category },
    { to: "/games/hangman", img: hangmanImg, title: t("games.hangman.title"), desc: t("games.hangman.desc"), badge: t("games.hangman.badge"), category: "Word" as Category },
    { to: "/games/jungle-survival", img: jungleImg, title: t("games.jungle.title"), desc: t("games.jungle.desc"), badge: t("games.jungle.badge"), category: "Adventure" as Category },
    { to: "/games/star-chef", img: starchefImg, title: t("games.starchef.title"), desc: t("games.starchef.desc"), badge: t("games.starchef.badge"), category: "Cooking" as Category },
    { to: "/games/uno-ultra", img: unoImg, title: t("games.uno.title"), desc: t("games.uno.desc"), badge: t("games.uno.badge"), category: "Cards" as Category },
    { to: "/games/neon-breach", img: neonbreachImg, title: t("games.neonbreach.title"), desc: t("games.neonbreach.desc"), badge: t("games.neonbreach.badge"), category: "Cyber" as Category },
    { to: "/games/logiquest", img: logiquestImg, title: t("games.logiquest.title"), desc: t("games.logiquest.desc"), badge: t("games.logiquest.badge"), category: "Logic" as Category },
    { to: "/games/trade-tycoon", img: tradetycoonImg, title: t("games.tradetycoon.title"), desc: t("games.tradetycoon.desc"), badge: t("games.tradetycoon.badge"), category: "Trading" as Category },
    { to: "/games/tactical-strike", img: tacticalImg, title: t("games.tactical.title"), desc: t("games.tactical.desc"), badge: t("games.tactical.badge"), category: "Action" as Category },
    { to: "/games/dominoes", img: dominoesImg, title: t("games.dominoes.title"), desc: t("games.dominoes.desc"), badge: t("games.dominoes.badge"), category: "Classic" as Category },
    { to: "/games/farkle", img: farkleImg, title: t("games.farkle.title"), desc: t("games.farkle.desc"), badge: t("games.farkle.badge"), category: "Dice" as Category },
    { to: "/games/briscola", img: briscolaImg, title: t("games.briscola.title"), desc: t("games.briscola.desc"), badge: t("games.briscola.badge"), category: "Cards" as Category },
    { to: "/games/card-99", img: card99Img, title: t("games.card99.title"), desc: t("games.card99.desc"), badge: t("games.card99.badge"), category: "Cards" as Category },
    { to: "/games/dream-home", img: dreamhomeImg, title: t("games.dreamhome.title"), desc: t("games.dreamhome.desc"), badge: t("games.dreamhome.badge"), category: "Design" as Category },
    { to: "/games/laptop-tech", img: laptoptechImg, title: t("games.laptoptech.title"), desc: t("games.laptoptech.desc"), badge: t("games.laptoptech.badge"), category: "Tech" as Category },
    { to: "/games/music-ear", img: earmasterImg, title: t("games.earmaster.title"), desc: t("games.earmaster.desc"), badge: t("games.earmaster.badge"), category: "Music" as Category },
    { to: "/games/fashion-designer", img: fashionImg, title: t("games.fashion.title"), desc: t("games.fashion.desc"), badge: t("games.fashion.badge"), category: "Creative" as Category },
    { to: "/games/velocity-racing", img: velocityImg, title: t("games.velocity.title"), desc: t("games.velocity.desc"), badge: t("games.velocity.badge"), category: "Racing" as Category },
  ], [t]);

  const categories: Category[] = ["All", ...Array.from(new Set(games.map(g => g.category))).sort() as Category[]];

  const filtered = useMemo(() => {
    return games.filter((g) => {
      const matchesSearch = !search || g.title.toLowerCase().includes(search.toLowerCase()) || g.desc.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "All" || g.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [games, search, activeCategory]);

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-12">
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-10 overflow-hidden rounded-2xl">
            <img src={gamesImg} alt="" className="h-48 w-full object-cover sm:h-56" width={800} height={512} loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-center">
              <h1 className="text-4xl font-bold tracking-tight">{t("games.title")}</h1>
              <p className="mt-2 text-lg text-muted-foreground">{t("games.subtitle")}</p>
            </div>
          </div>
        </AnimatedSection>

        {/* Search & Filter */}
        <div className="mb-6 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("games.searchPlaceholder") || "Search games..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={activeCategory === cat ? "default" : "outline"}
                onClick={() => setActiveCategory(cat)}
                className="text-xs"
              >
                {cat === "All" && <Filter className="mr-1 h-3.5 w-3.5" />}
                {cat} {cat !== "All" && `(${games.filter(g => g.category === cat).length})`}
              </Button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">No games found matching your search.</p>
        ) : (
          <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((game) => (
              <StaggerItem key={game.to}>
                <Link to={game.to} className="group" onClick={() => playSound("start")}>
                  <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="relative h-36 w-full overflow-hidden">
                      <img
                        src={game.img}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        width={768}
                        height={512}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                      <Badge variant="secondary" className="absolute top-2 end-2 text-xs">
                        {game.badge}
                      </Badge>
                    </div>
                    <div className="px-4 pb-4 pt-3">
                      <CardTitle className="text-base group-hover:text-primary transition-colors">
                        {game.title}
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs line-clamp-2">
                        {game.desc}
                      </CardDescription>
                    </div>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}
      </section>
    </Layout>
  );
}
