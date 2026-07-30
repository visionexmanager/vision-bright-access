import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useGenerateAiStory } from "@/features/visionkids/hooks/stories/useAiStoryGenerator";
import { useAwardAchievement, useAwardXp } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import type { AgeGroup } from "@/features/visionkids/types/stories.types";

const EXAMPLE_PROMPTS = [
  "kids.ai.example1",
  "kids.ai.example2",
  "kids.ai.example3",
];

export default function AiStoryCreate() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduced = useKidsReducedMotion();
  const generate = useGenerateAiStory();
  const awardAchievement = useAwardAchievement();
  const awardXp = useAwardXp();

  const [prompt, setPrompt] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("6-8");

  useDocumentHead({ title: t("kids.ai.createTitle"), description: t("kids.ai.subtitle"), canonicalPath: "/kids/stories/ai/create" });

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    try {
      const story = await generate.mutateAsync({ prompt: prompt.trim(), ageGroup });
      awardXp.mutate({ amount: 10, reason: `AI story created: ${story.id}` });
      awardAchievement.mutate("first_ai_story");
      navigate(`/kids/stories/ai/${story.id}`);
    } catch {
      // error surfaced via generate.isError below
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/kids/stories/ai" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.ai.libraryTitle")}
      </Link>

      <motion.h1 variants={slideUp(reduced)} className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Sparkles className="h-6 w-6 text-kids-purple" aria-hidden="true" /> {t("kids.ai.createTitle")}
      </motion.h1>
      <motion.p variants={fadeIn(reduced)} className="mt-1 text-muted-foreground">{t("kids.ai.createSubtitle")}</motion.p>

      <motion.div variants={slideUp(reduced)} className="mt-6 rounded-2xl border-2 border-border bg-card p-5">
        <label htmlFor="kids-ai-prompt" className="text-sm font-semibold">{t("kids.ai.promptLabel")}</label>
        <Textarea
          id="kids-ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("kids.ai.promptPlaceholder")}
          className="mt-2 min-h-28"
          maxLength={300}
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLE_PROMPTS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPrompt(t(key))}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {t(key)}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label htmlFor="kids-ai-age" className="text-sm font-semibold">{t("kids.stories.ageGroup")}</label>
          <Select value={ageGroup} onValueChange={(v) => setAgeGroup(v as AgeGroup)}>
            <SelectTrigger id="kids-ai-age" className="mt-1 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3-5">3-5</SelectItem>
              <SelectItem value="6-8">6-8</SelectItem>
              <SelectItem value="9-12">9-12</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {generate.isError && <p className="mt-3 text-sm text-destructive" role="alert">{t("kids.ai.generateError")}</p>}

        <Button
          onClick={handleGenerate}
          disabled={!prompt.trim() || generate.isPending}
          className="mt-5 w-full gap-1.5 bg-gradient-to-r from-kids-purple to-kids-pink text-white hover:opacity-90"
        >
          {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {generate.isPending ? t("kids.ai.generating") : t("kids.ai.generate")}
        </Button>
      </motion.div>
    </motion.div>
  );
}
