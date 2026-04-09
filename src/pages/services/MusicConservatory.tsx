import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import { Music, Headphones, Piano, Mic2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useCallback } from "react";

const NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const FREQ: Record<string, number> = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392, A: 440, B: 493.88 };

export default function MusicConservatory() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [activeNote, setActiveNote] = useState<string | null>(null);

  const playNote = useCallback((note: string) => {
    setActiveNote(note);
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = FREQ[note];
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {}
    setTimeout(() => setActiveNote(null), 300);
  }, []);

  const courses = [
    { icon: Piano, title: t("music.coursePiano"), level: t("music.beginner") },
    { icon: Mic2, title: t("music.courseVocal"), level: t("music.intermediate") },
    { icon: Headphones, title: t("music.courseProduction"), level: t("music.advanced") },
    { icon: Volume2, title: t("music.courseTheory"), level: t("music.beginner") },
  ];

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-10">
        <AnimatedSection variants={scaleFade}>
          <div className="mb-10 text-center">
            <Music className="mx-auto mb-3 h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold">{t("music.title")}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{t("music.subtitle")}</p>
          </div>
        </AnimatedSection>

        {/* Interactive Piano */}
        <AnimatedSection className="mb-10">
          <Card>
            <CardHeader>
              <CardTitle>{t("music.tryPiano")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-1">
                {NOTES.map((note) => (
                  <button
                    key={note}
                    onClick={() => playNote(note)}
                    className={`h-32 w-12 sm:w-16 rounded-b-lg border-2 text-lg font-bold transition-all ${
                      activeNote === note
                        ? "bg-primary text-primary-foreground scale-95 border-primary"
                        : "bg-card hover:bg-accent border-border"
                    }`}
                    aria-label={`Play note ${note}`}
                  >
                    {note}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((c) => (
            <StaggerItem key={c.title}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardHeader className="text-center">
                  <c.icon className="mx-auto h-10 w-10 text-primary" />
                  <CardTitle className="text-lg mt-2">{c.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <Badge variant="secondary">{c.level}</Badge>
                  <Button className="w-full mt-4" onClick={() => { playSound("success"); toast.success(t("music.enrolled")); }}>
                    {t("music.enroll")}
                  </Button>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>
    </Layout>
  );
}
