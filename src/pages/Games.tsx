import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Grid3X3, Type, Skull, ChefHat, Layers, Brain, Zap, TrendingUp, Target, Spade, CreditCard, Home, Laptop, Music, Scissors, Car } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import gamesImg from "@/assets/games-illustration.jpg";
import quizImg from "@/assets/game-quiz.jpg";
import memoryImg from "@/assets/game-memory.jpg";
import wordImg from "@/assets/game-word.jpg";

export default function Games() {
  const { t } = useLanguage();
  const { playSound } = useSound();

  const games = [
    { to: "/games/quiz-challenge", icon: <Gamepad2 className="h-7 w-7 text-primary" />, title: t("games.quiz.title"), desc: t("games.quiz.desc"), badge: t("games.quiz.badge") },
    { to: "/games/memory", icon: <Grid3X3 className="h-7 w-7 text-primary" />, title: t("games.memory.title"), desc: t("games.memory.desc"), badge: t("games.memory.badge") },
    { to: "/games/word-puzzle", icon: <Type className="h-7 w-7 text-primary" />, title: t("games.word.title"), desc: t("games.word.desc"), badge: t("games.word.badge") },
    { to: "/games/hangman", icon: <Type className="h-7 w-7 text-primary" />, title: t("games.hangman.title"), desc: t("games.hangman.desc"), badge: t("games.hangman.badge") },
    { to: "/games/jungle-survival", icon: <Skull className="h-7 w-7 text-primary" />, title: t("games.jungle.title"), desc: t("games.jungle.desc"), badge: t("games.jungle.badge") },
    { to: "/games/star-chef", icon: <ChefHat className="h-7 w-7 text-primary" />, title: t("games.starchef.title"), desc: t("games.starchef.desc"), badge: t("games.starchef.badge") },
    { to: "/games/uno-ultra", icon: <Layers className="h-7 w-7 text-primary" />, title: t("games.uno.title"), desc: t("games.uno.desc"), badge: t("games.uno.badge") },
    { to: "/games/neon-breach", icon: <Zap className="h-7 w-7 text-primary" />, title: t("games.neonbreach.title"), desc: t("games.neonbreach.desc"), badge: t("games.neonbreach.badge") },
    { to: "/games/logiquest", icon: <Brain className="h-7 w-7 text-primary" />, title: t("games.logiquest.title"), desc: t("games.logiquest.desc"), badge: t("games.logiquest.badge") },
    { to: "/games/trade-tycoon", icon: <TrendingUp className="h-7 w-7 text-primary" />, title: t("games.tradetycoon.title"), desc: t("games.tradetycoon.desc"), badge: t("games.tradetycoon.badge") },
    { to: "/games/tactical-strike", icon: <Target className="h-7 w-7 text-primary" />, title: t("games.tactical.title"), desc: t("games.tactical.desc"), badge: t("games.tactical.badge") },
    { to: "/games/dominoes", icon: <Grid3X3 className="h-7 w-7 text-primary" />, title: t("games.dominoes.title"), desc: t("games.dominoes.desc"), badge: t("games.dominoes.badge") },
    { to: "/games/farkle", icon: <Gamepad2 className="h-7 w-7 text-primary" />, title: t("games.farkle.title"), desc: t("games.farkle.desc"), badge: t("games.farkle.badge") },
    { to: "/games/briscola", icon: <Spade className="h-7 w-7 text-primary" />, title: t("games.briscola.title"), desc: t("games.briscola.desc"), badge: t("games.briscola.badge") },
    { to: "/games/card-99", icon: <CreditCard className="h-7 w-7 text-primary" />, title: t("games.card99.title"), desc: t("games.card99.desc"), badge: t("games.card99.badge") },
    { to: "/games/dream-home", icon: <Home className="h-7 w-7 text-primary" />, title: t("games.dreamhome.title"), desc: t("games.dreamhome.desc"), badge: t("games.dreamhome.badge") },
    { to: "/games/laptop-tech", icon: <Laptop className="h-7 w-7 text-primary" />, title: t("games.laptoptech.title"), desc: t("games.laptoptech.desc"), badge: t("games.laptoptech.badge") },
    { to: "/games/music-ear", icon: <Music className="h-7 w-7 text-primary" />, title: t("games.earmaster.title"), desc: t("games.earmaster.desc"), badge: t("games.earmaster.badge") },
    { to: "/games/fashion-designer", icon: <Scissors className="h-7 w-7 text-primary" />, title: t("games.fashion.title"), desc: t("games.fashion.desc"), badge: t("games.fashion.badge") },
    { to: "/games/velocity-racing", icon: <Car className="h-7 w-7 text-primary" />, title: t("games.velocity.title"), desc: t("games.velocity.desc"), badge: t("games.velocity.badge") },
  ];

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

        <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((game) => (
            <StaggerItem key={game.to}>
              <Link to={game.to} className="group" onClick={() => playSound("start")}>
                <Card className="h-full transition-shadow hover:shadow-lg">
                  <CardHeader className="pt-5 pb-3">
                    <div className="mb-2 flex items-center gap-2">
                      {game.icon}
                      <Badge variant="secondary">{game.badge}</Badge>
                    </div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">{game.title}</CardTitle>
                    <CardDescription className="text-sm">{game.desc}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>
    </Layout>
  );
}
