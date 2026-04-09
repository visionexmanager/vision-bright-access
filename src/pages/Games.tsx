import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Grid3X3, Type } from "lucide-react";
import { Link } from "react-router-dom";
import gamesImg from "@/assets/games-illustration.jpg";
import quizImg from "@/assets/game-quiz.jpg";
import memoryImg from "@/assets/game-memory.jpg";
import wordImg from "@/assets/game-word.jpg";

export default function Games() {
  const { t } = useLanguage();
  const { playSound } = useSound();

  const games = [
    {
      to: "/games/quiz-challenge",
      icon: <Gamepad2 className="h-8 w-8 text-primary" aria-hidden="true" />,
      badge: t("games.quiz.badge"),
      title: t("games.quiz.title"),
      desc: t("games.quiz.desc"),
      info: t("games.quiz.info"),
      img: quizImg,
    },
    {
      to: "/games/memory",
      icon: <Grid3X3 className="h-8 w-8 text-primary" aria-hidden="true" />,
      badge: t("games.memory.badge"),
      title: t("games.memory.title"),
      desc: t("games.memory.desc"),
      info: t("games.memory.info"),
      img: memoryImg,
    },
    {
      to: "/games/word-puzzle",
      icon: <Type className="h-8 w-8 text-primary" aria-hidden="true" />,
      badge: t("games.word.badge"),
      title: t("games.word.title"),
      desc: t("games.word.desc"),
      info: t("games.word.info"),
      img: wordImg,
    },
  ];

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-4 py-12">
        {/* Hero banner */}
        <div className="relative mb-10 overflow-hidden rounded-2xl">
          <img
            src={gamesImg}
            alt=""
            className="h-48 w-full object-cover sm:h-56"
            width={800}
            height={512}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight">{t("games.title")}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{t("games.subtitle")}</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Link key={game.to} to={game.to} className="group" onClick={() => playSound("start")}>
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
                <div className="relative h-40 w-full overflow-hidden">
                  <img
                    src={game.img}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    width={640}
                    height={512}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                </div>
                <CardHeader className="pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    {game.icon}
                    <Badge variant="secondary">{game.badge}</Badge>
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {game.title}
                  </CardTitle>
                  <CardDescription>{game.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{game.info}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
