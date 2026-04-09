import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
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

export default function Games() {
  const { t } = useLanguage();
  const { playSound } = useSound();

  const games = [
    { to: "/games/quiz-challenge", img: quizImg, title: t("games.quiz.title"), desc: t("games.quiz.desc"), badge: t("games.quiz.badge") },
    { to: "/games/memory", img: memoryImg, title: t("games.memory.title"), desc: t("games.memory.desc"), badge: t("games.memory.badge") },
    { to: "/games/word-puzzle", img: wordImg, title: t("games.word.title"), desc: t("games.word.desc"), badge: t("games.word.badge") },
    { to: "/games/hangman", img: hangmanImg, title: t("games.hangman.title"), desc: t("games.hangman.desc"), badge: t("games.hangman.badge") },
    { to: "/games/jungle-survival", img: jungleImg, title: t("games.jungle.title"), desc: t("games.jungle.desc"), badge: t("games.jungle.badge") },
    { to: "/games/star-chef", img: starchefImg, title: t("games.starchef.title"), desc: t("games.starchef.desc"), badge: t("games.starchef.badge") },
    { to: "/games/uno-ultra", img: unoImg, title: t("games.uno.title"), desc: t("games.uno.desc"), badge: t("games.uno.badge") },
    { to: "/games/neon-breach", img: neonbreachImg, title: t("games.neonbreach.title"), desc: t("games.neonbreach.desc"), badge: t("games.neonbreach.badge") },
    { to: "/games/logiquest", img: logiquestImg, title: t("games.logiquest.title"), desc: t("games.logiquest.desc"), badge: t("games.logiquest.badge") },
    { to: "/games/trade-tycoon", img: tradetycoonImg, title: t("games.tradetycoon.title"), desc: t("games.tradetycoon.desc"), badge: t("games.tradetycoon.badge") },
    { to: "/games/tactical-strike", img: tacticalImg, title: t("games.tactical.title"), desc: t("games.tactical.desc"), badge: t("games.tactical.badge") },
    { to: "/games/dominoes", img: dominoesImg, title: t("games.dominoes.title"), desc: t("games.dominoes.desc"), badge: t("games.dominoes.badge") },
    { to: "/games/farkle", img: farkleImg, title: t("games.farkle.title"), desc: t("games.farkle.desc"), badge: t("games.farkle.badge") },
    { to: "/games/briscola", img: briscolaImg, title: t("games.briscola.title"), desc: t("games.briscola.desc"), badge: t("games.briscola.badge") },
    { to: "/games/card-99", img: card99Img, title: t("games.card99.title"), desc: t("games.card99.desc"), badge: t("games.card99.badge") },
    { to: "/games/dream-home", img: dreamhomeImg, title: t("games.dreamhome.title"), desc: t("games.dreamhome.desc"), badge: t("games.dreamhome.badge") },
    { to: "/games/laptop-tech", img: laptoptechImg, title: t("games.laptoptech.title"), desc: t("games.laptoptech.desc"), badge: t("games.laptoptech.badge") },
    { to: "/games/music-ear", img: earmasterImg, title: t("games.earmaster.title"), desc: t("games.earmaster.desc"), badge: t("games.earmaster.badge") },
    { to: "/games/fashion-designer", img: fashionImg, title: t("games.fashion.title"), desc: t("games.fashion.desc"), badge: t("games.fashion.badge") },
    { to: "/games/velocity-racing", img: velocityImg, title: t("games.velocity.title"), desc: t("games.velocity.desc"), badge: t("games.velocity.badge") },
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
                <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
                  <div className="relative h-36 w-full overflow-hidden">
                    <img
                      src={game.img}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
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
      </section>
    </Layout>
  );
}
