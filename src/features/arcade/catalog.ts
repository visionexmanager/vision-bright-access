import quizImg from "@/assets/arcade/game-quiz-premium-v1.webp";
import memoryImg from "@/assets/arcade/game-memory-premium-v1.webp";
import wordImg from "@/assets/arcade/game-word-puzzle-premium-v1.webp";
import hangmanImg from "@/assets/arcade/game-hangman-premium-v1.webp";
import jungleImg from "@/assets/arcade/game-jungle-survival-premium-v1.webp";
import starchefImg from "@/assets/arcade/game-star-chef-premium-v1.webp";
import unoImg from "@/assets/arcade/game-uno-ultra-premium-v1.webp";
import neonbreachImg from "@/assets/arcade/game-neon-breach-premium-v1.webp";
import logiquestImg from "@/assets/arcade/game-logiquest-premium-v1.webp";
import tradetycoonImg from "@/assets/arcade/game-trade-tycoon-premium-v1.webp";
import tacticalImg from "@/assets/arcade/game-tactical-strike-premium-v1.webp";
import dominoesImg from "@/assets/arcade/game-dominoes-premium-v1.webp";
import farkleImg from "@/assets/arcade/game-farkle-premium-v1.webp";
import briscolaImg from "@/assets/arcade/game-briscola-premium-v1.webp";
import card99Img from "@/assets/arcade/game-card-99-premium-v1.webp";
import dreamhomeImg from "@/assets/arcade/game-dream-home-premium-v1.webp";
import laptoptechImg from "@/assets/arcade/game-laptop-tech-premium-v1.webp";
import earmasterImg from "@/assets/arcade/game-music-ear-premium-v1.webp";
import fashionImg from "@/assets/arcade/game-fashion-designer-premium-v1.webp";
import velocityImg from "@/assets/arcade/game-velocity-premium-v1.webp";
import visionopolyImg from "@/assets/game-visionopoly.svg";
import akinatorImg from "@/assets/arcade/game-akinator-premium-v1.webp";

export type ArcadeCategory = "Action" | "Puzzle" | "Strategy" | "Educational" | "Kids" | "Classic" | "Multiplayer" | "Accessible";
export type ArcadeDifficulty = "Easy" | "Medium" | "Hard";
export type ArcadeAge = "Everyone" | "Kids" | "Teens";

export interface ArcadeGame {
  slug: string;
  to: string;
  image: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  categories: ArcadeCategory[];
  difficulty: ArcadeDifficulty;
  age: ArcadeAge;
  players: string;
  plays: number;
  rating: number;
  featured?: boolean;
  trending?: boolean;
  recentlyAdded?: boolean;
  controls: string[];
  accessible: boolean;
}

const game = (data: ArcadeGame) => data;

export const ARCADE_GAMES: ArcadeGame[] = [
  game({ slug:"quiz-challenge", to:"/games/quiz-challenge", image:quizImg, title:"Quiz Challenge", titleAr:"تحدي المعلومات", description:"Fast questions, smart choices, and competitive rounds.", descriptionAr:"أسئلة سريعة وخيارات ذكية وجولات تنافسية.", categories:["Puzzle","Educational","Multiplayer","Accessible"], difficulty:"Medium", age:"Everyone", players:"1–2", plays:0, rating:0, featured:true, trending:true, controls:["Keyboard","Touch"], accessible:true }),
  game({ slug:"memory", to:"/games/memory", image:memoryImg, title:"Memory Game", titleAr:"لعبة الذاكرة", description:"Match every pair while sharpening focus and recall.", descriptionAr:"طابق الأزواج وطوّر التركيز والذاكرة.", categories:["Puzzle","Educational","Kids","Accessible"], difficulty:"Easy", age:"Kids", players:"1", plays:0, rating:0, featured:true, controls:["Keyboard","Touch","Voice prompts"], accessible:true }),
  game({ slug:"word-puzzle", to:"/games/word-puzzle", image:wordImg, title:"Word Puzzle", titleAr:"لغز الكلمات", description:"Build words, expand vocabulary, and beat the clock.", descriptionAr:"كوّن الكلمات ووسّع مفرداتك وتحدَّ الوقت.", categories:["Puzzle","Educational","Kids","Accessible"], difficulty:"Medium", age:"Everyone", players:"1", plays:0, rating:0, trending:true, controls:["Keyboard","Touch","Voice prompts"], accessible:true }),
  game({ slug:"hangman", to:"/games/hangman", image:hangmanImg, title:"Hangman", titleAr:"الرجل المشنوق", description:"Reveal the hidden word before your guesses run out.", descriptionAr:"اكتشف الكلمة المخفية قبل نفاد المحاولات.", categories:["Puzzle","Educational","Classic","Multiplayer"], difficulty:"Medium", age:"Everyone", players:"1–2", plays:0, rating:0, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"akinator", to:"/games/akinator", image:akinatorImg, title:"Akinator", titleAr:"أكيناتور", description:"Answer clever questions and challenge the guessing engine.", descriptionAr:"أجب عن أسئلة ذكية وتحدَّ محرك التخمين.", categories:["Puzzle","Kids"], difficulty:"Easy", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"jungle-survival", to:"/games/jungle-survival", image:jungleImg, title:"Jungle Survival", titleAr:"النجاة في الأدغال", description:"Make the right survival choices in a living jungle.", descriptionAr:"اتخذ قرارات النجاة الصحيحة داخل الأدغال.", categories:["Action","Strategy","Multiplayer"], difficulty:"Hard", age:"Teens", players:"1–2", plays:0, rating:0, trending:true, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"neon-breach", to:"/games/neon-breach", image:neonbreachImg, title:"Neon Breach", titleAr:"اختراق النيون", description:"Decode luminous sequences and break the firewall.", descriptionAr:"فك تسلسلات النيون واخترق جدار الحماية.", categories:["Action","Puzzle","Multiplayer"], difficulty:"Hard", age:"Teens", players:"1–2", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"tactical-strike", to:"/games/tactical-strike", image:tacticalImg, title:"Tactical Strike", titleAr:"الضربة التكتيكية", description:"Plan each move and hit the right tactical target.", descriptionAr:"خطط لكل حركة وأصب الهدف التكتيكي الصحيح.", categories:["Action","Strategy","Multiplayer"], difficulty:"Hard", age:"Teens", players:"1–2", plays:0, rating:0, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"velocity-racing", to:"/games/velocity-racing", image:velocityImg, title:"Velocity X Racing", titleAr:"سباق Velocity X", description:"React fast, master the track, and chase the podium.", descriptionAr:"تفاعل بسرعة وسيطر على الحلبة وطارد منصة الفوز.", categories:["Action","Multiplayer"], difficulty:"Hard", age:"Everyone", players:"1–2", plays:0, rating:0, featured:true, trending:true, controls:["Arrow keys","Touch"], accessible:false }),
  game({ slug:"star-chef", to:"/games/star-chef", image:starchefImg, title:"Star Chef", titleAr:"الطاهي النجم", description:"Read the order, choose ingredients, and plate it perfectly.", descriptionAr:"اقرأ الطلب واختر المكونات وقدّم الطبق بإتقان.", categories:["Educational","Kids","Multiplayer"], difficulty:"Medium", age:"Kids", players:"1–2", plays:0, rating:0, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"dream-home", to:"/games/dream-home", image:dreamhomeImg, title:"Dream Home", titleAr:"منزل الأحلام", description:"Design welcoming rooms and complete every brief.", descriptionAr:"صمم غرفاً جميلة وأنجز كل تحدٍ.", categories:["Strategy","Kids"], difficulty:"Easy", age:"Everyone", players:"1", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"music-ear", to:"/games/music-ear", image:earmasterImg, title:"Music Ear Master", titleAr:"خبير الأذن الموسيقية", description:"Train your ear to identify notes with precision.", descriptionAr:"درّب أذنك على تمييز النغمات بدقة.", categories:["Educational","Accessible","Multiplayer"], difficulty:"Medium", age:"Everyone", players:"1–2", plays:0, rating:0, featured:true, controls:["Keyboard","Audio","Touch"], accessible:true }),
  game({ slug:"fashion-designer", to:"/games/fashion-designer", image:fashionImg, title:"Fashion Designer", titleAr:"مصمم الأزياء", description:"Combine fabric, color, and style for every occasion.", descriptionAr:"ادمج القماش واللون والأسلوب لكل مناسبة.", categories:["Strategy","Kids"], difficulty:"Easy", age:"Everyone", players:"1", plays:0, rating:0, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"uno-ultra", to:"/games/uno-ultra", image:unoImg, title:"Uno Ultra", titleAr:"أونو ألترا", description:"Match colors and numbers in a rapid card showdown.", descriptionAr:"طابق الألوان والأرقام في مواجهة ورق سريعة.", categories:["Classic","Multiplayer"], difficulty:"Easy", age:"Everyone", players:"1–2", plays:0, rating:0, trending:true, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"dominoes", to:"/games/dominoes", image:dominoesImg, title:"Dominoes", titleAr:"الدومينو", description:"A polished classic built around smart tile placement.", descriptionAr:"لعبة كلاسيكية تعتمد على وضع الأحجار بذكاء.", categories:["Classic","Strategy","Multiplayer"], difficulty:"Medium", age:"Everyone", players:"1–2", plays:0, rating:0, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"farkle", to:"/games/farkle", image:farkleImg, title:"Farkle", titleAr:"فاركل", description:"Push your luck, bank the dice, and build a winning score.", descriptionAr:"غامر بذكاء وثبّت النرد واجمع نقاط الفوز.", categories:["Classic","Strategy","Multiplayer"], difficulty:"Medium", age:"Everyone", players:"1–2", plays:0, rating:0, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"briscola", to:"/games/briscola", image:briscolaImg, title:"Briscola", titleAr:"بريسكولا", description:"Master timing and tactics in the classic card game.", descriptionAr:"أتقن التوقيت والتكتيك في لعبة الورق الكلاسيكية.", categories:["Classic","Strategy","Multiplayer"], difficulty:"Hard", age:"Everyone", players:"1–2", plays:0, rating:0, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"card-99", to:"/games/card-99", image:card99Img, title:"Card 99", titleAr:"بطاقة 99", description:"Keep the total under control and outthink your rival.", descriptionAr:"حافظ على المجموع وتفوّق على منافسك.", categories:["Classic","Strategy","Multiplayer"], difficulty:"Medium", age:"Everyone", players:"1–2", plays:0, rating:0, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"logiquest", to:"/games/logiquest", image:logiquestImg, title:"LogiQuest", titleAr:"لوجيكويست", description:"Progress through layered logic challenges.", descriptionAr:"تقدم عبر تحديات منطقية متعددة المستويات.", categories:["Puzzle","Educational","Multiplayer"], difficulty:"Hard", age:"Everyone", players:"1–2", plays:0, rating:0, featured:true, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"trade-tycoon", to:"/games/trade-tycoon", image:tradetycoonImg, title:"Trade Tycoon", titleAr:"إمبراطور التجارة", description:"Read the market and grow a winning trading strategy.", descriptionAr:"اقرأ السوق وابنِ استراتيجية تجارية ناجحة.", categories:["Strategy","Educational","Multiplayer"], difficulty:"Hard", age:"Teens", players:"1–2", plays:0, rating:0, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"laptop-tech", to:"/games/laptop-tech", image:laptoptechImg, title:"Laptop Tech Master", titleAr:"خبير صيانة الحاسوب", description:"Diagnose faults and repair devices step by step.", descriptionAr:"شخّص الأعطال وأصلح الأجهزة خطوة بخطوة.", categories:["Puzzle","Educational","Multiplayer"], difficulty:"Medium", age:"Everyone", players:"1–2", plays:0, rating:0, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:false }),
  game({ slug:"visionopoly", to:"/games/visionopoly", image:visionopolyImg, title:"Visionopoly", titleAr:"فيجِنوبولي", description:"Build a property empire with trading, mortgages, and smart rivals.", descriptionAr:"ابنِ إمبراطورية عقارية عبر التجارة والرهن ومنافسين أذكياء.", categories:["Strategy","Classic"], difficulty:"Hard", age:"Everyone", players:"1", plays:0, rating:0, featured:true, recentlyAdded:true, controls:["Keyboard","Touch"], accessible:false }),
];

export const ARCADE_CATEGORIES: ArcadeCategory[] = ["Action","Puzzle","Strategy","Educational","Kids","Classic","Multiplayer","Accessible"];

export function getArcadeGame(pathname: string) {
  return ARCADE_GAMES.find((item) => item.to === pathname);
}

export function localizeGame(item: ArcadeGame, lang: string) {
  return lang === "ar"
    ? { title: item.titleAr, description: item.descriptionAr }
    : { title: item.title, description: item.description };
}
