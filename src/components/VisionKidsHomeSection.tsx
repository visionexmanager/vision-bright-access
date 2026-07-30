import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, BookOpen, Gamepad2, Rocket, Accessibility } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { AnimatedSection } from "@/components/AnimatedSection";

/**
 * Prominent VisionKids entry point on the public Visionex homepage
 * (Phase 21, Parts 32–35). Deliberately NOT hidden in a submenu: a full-width
 * banded section with a clear heading, description, feature pills, and a single
 * primary CTA into /kids.
 *
 * Accessibility: semantic <section> labelled by its heading, the CTA is a real
 * link (keyboard-focusable, screen-reader announced), all decorative glyphs are
 * aria-hidden, and colour is never the only signal. Responsive: text + visual
 * stack on mobile, side-by-side from md.
 */
export function VisionKidsHomeSection() {
  const { t } = useLanguage();
  const { playSound } = useSound();

  const pills = [
    { icon: BookOpen, label: t("home.kids.pill.stories") },
    { icon: Gamepad2, label: t("home.kids.pill.games") },
    { icon: Rocket, label: t("home.kids.pill.learn") },
    { icon: Accessibility, label: t("home.kids.pill.accessible") },
  ];

  return (
    <section className="px-4 py-20" aria-labelledby="visionkids-heading">
      <div className="section-container">
        <AnimatedSection>
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent p-8 sm:p-12">
            <div
              className="pointer-events-none absolute -end-10 -top-10 h-48 w-48 rounded-full bg-primary/10 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative grid items-center gap-10 md:grid-cols-2">
              {/* Text */}
              <div>
                <p className="type-overline mb-3 inline-flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {t("home.kids.overline")}
                </p>
                <h2 id="visionkids-heading" className="type-heading mb-4">
                  {t("home.kids.title")}
                </h2>
                <p className="mb-6 max-w-lg text-muted-foreground leading-relaxed">
                  {t("home.kids.desc")}
                </p>

                <ul className="mb-8 flex flex-wrap gap-2" aria-label={t("home.kids.pillsLabel")}>
                  {pills.map(({ icon: Icon, label }) => (
                    <li
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-sm font-medium"
                    >
                      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>

                <Link to="/kids" onClick={() => playSound("navigate")}>
                  <Button size="lg" className="px-8 py-6 text-lg font-semibold">
                    {t("home.kids.cta")}
                    <ArrowRight className="ms-2 h-5 w-5 rtl:rotate-180" aria-hidden="true" />
                  </Button>
                </Link>
              </div>

              {/* Visual */}
              <div className="flex justify-center" aria-hidden="true">
                <div className="grid grid-cols-2 gap-4">
                  {["📚", "🎮", "🔬", "🌍", "🎨", "🚀"].map((emoji, i) => (
                    <div
                      key={emoji}
                      className={`flex h-24 w-24 items-center justify-center rounded-2xl border border-border bg-card text-5xl shadow-sm ${
                        i % 2 === 0 ? "translate-y-2" : "-translate-y-2"
                      }`}
                    >
                      {emoji}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
