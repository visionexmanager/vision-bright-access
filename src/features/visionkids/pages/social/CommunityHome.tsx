import { Link } from "react-router-dom";
import { Users, MessagesSquare, Mic, Trophy, BookOpen, Palette, GraduationCap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

const LINKS = [
  { to: "/kids/social/friends", icon: Users, color: "text-kids-primary", labelKey: "kids.social.nav.friends" },
  { to: "/kids/social/clubs/study", icon: GraduationCap, color: "text-kids-secondary", labelKey: "kids.social.nav.studyGroups" },
  { to: "/kids/social/clubs/reading", icon: BookOpen, color: "text-kids-accent", labelKey: "kids.social.nav.readingClubs" },
  { to: "/kids/social/clubs/creative", icon: Palette, color: "text-kids-pink", labelKey: "kids.social.nav.creativeClubs" },
  { to: "/kids/social/chat", icon: MessagesSquare, color: "text-kids-green", labelKey: "kids.social.nav.safeChat" },
  { to: "/kids/social/voice-rooms", icon: Mic, color: "text-kids-purple", labelKey: "kids.social.nav.voiceRooms" },
  { to: "/kids/social/challenges", icon: Trophy, color: "text-kids-accent", labelKey: "kids.social.nav.challengesHub" },
];

export default function CommunityHome() {
  const { t } = useLanguage();

  useDocumentHead({ title: t("kids.social.meta.title"), description: t("kids.social.meta.description"), canonicalPath: "/kids/social" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">🤝 {t("kids.social.heroTitle")}</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{t("kids.social.heroSubtitle")}</p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-5 text-center transition-transform hover:scale-[1.03]"
          >
            <link.icon className={`h-8 w-8 ${link.color}`} aria-hidden="true" />
            <p className="font-heading text-sm font-bold">{t(link.labelKey)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
