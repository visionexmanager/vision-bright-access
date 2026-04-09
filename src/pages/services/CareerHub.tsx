import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { AnimatedSection, StaggerGrid, StaggerItem, scaleFade } from "@/components/AnimatedSection";
import { Briefcase, Target, FileText, Users, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import heroImg from "@/assets/service-career.jpg";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export default function CareerHub() {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [skills, setSkills] = useState("");
  const [interest, setInterest] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const tools = [
    { icon: Target, title: t("career.toolAptitude"), desc: t("career.toolAptitudeDesc"), color: "text-blue-500" },
    { icon: FileText, title: t("career.toolResume"), desc: t("career.toolResumeDesc"), color: "text-green-500" },
    { icon: Users, title: t("career.toolInterview"), desc: t("career.toolInterviewDesc"), color: "text-purple-500" },
    { icon: Sparkles, title: t("career.toolMentor"), desc: t("career.toolMentorDesc"), color: "text-amber-500" },
  ];

  const handleAnalyze = () => {
    if (!skills.trim()) { toast.error(t("career.enterSkills")); return; }
    playSound("success");
    const careers = [
      "Software Developer", "UI/UX Designer", "Data Analyst", "Project Manager",
      "Digital Marketing Specialist", "Cybersecurity Analyst", "Product Manager",
      "Technical Writer", "Cloud Engineer", "AI/ML Engineer",
    ];
    const picked = careers.sort(() => Math.random() - 0.5).slice(0, 3);
    setResult(picked.join(" • "));
    toast.success(t("career.analysisComplete"));
  };

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-10">
        <AnimatedSection variants={scaleFade}>
          <div className="relative mb-10 overflow-hidden rounded-2xl">
            <img src={heroImg} alt="" className="h-44 w-full object-cover sm:h-52" width={800} height={512} loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-center">
              <Briefcase className="mx-auto mb-2 h-10 w-10 text-primary" />
              <h1 className="text-4xl font-bold">{t("career.title")}</h1>
              <p className="mt-1 text-lg text-muted-foreground">{t("career.subtitle")}</p>
            </div>
          </div>
        </AnimatedSection>

        <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          {tools.map((tool) => (
            <StaggerItem key={tool.title}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardHeader className="text-center">
                  <tool.icon className={`mx-auto h-10 w-10 ${tool.color}`} />
                  <CardTitle className="text-lg mt-2">{tool.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center">{tool.desc}</p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGrid>

        <AnimatedSection>
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                {t("career.quickAnalysis")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder={t("career.skillsPlaceholder")}
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
              />
              <Textarea
                placeholder={t("career.interestPlaceholder")}
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                rows={3}
              />
              <Button size="lg" className="w-full" onClick={handleAnalyze}>
                {t("career.analyze")} <ArrowRight className="ms-2 h-5 w-5" />
              </Button>
              {result && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-6 mt-4">
                  <h3 className="font-bold text-lg mb-2">{t("career.suggestedCareers")}</h3>
                  <p className="text-xl font-semibold text-primary">{result}</p>
                  <Badge className="mt-3">{t("career.earnPoints")}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      </section>
    </Layout>
  );
}
