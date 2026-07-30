import { useState } from "react";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { useSaveProject } from "@/features/visionkids/hooks/stem/useStemProjects";
import { DESIGN_TEMPLATES, DESIGN_COLORS } from "@/features/visionkids/data/stemConfig";
import { StemHeader } from "@/features/visionkids/components/stem/StemHeader";
import { StemRewardBanner } from "@/features/visionkids/components/stem/StemRewardBanner";

const SIZES = [
  { slug: "small", scale: 0.7 },
  { slug: "medium", scale: 1 },
  { slug: "large", scale: 1.3 },
];

export default function Design3DStudio() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();
  const saveProject = useSaveProject();

  const [template, setTemplate] = useState(DESIGN_TEMPLATES[0]);
  const [color, setColor] = useState(DESIGN_COLORS[4]); // blue
  const [size, setSize] = useState(SIZES[1]);
  const [spin, setSpin] = useState(true);
  const [title, setTitle] = useState("");
  const [reward, setReward] = useState(false);
  const [saved, setSaved] = useState(false);

  useDocumentHead({
    title: `${t("kids.stem.lab.design3d.title")} — VisionKids`,
    description: t("kids.stem.lab.design3d.subtitle"),
    canonicalPath: "/kids/stem/design3d",
  });

  async function save() {
    if (!user || !title.trim()) return;
    try {
      await saveProject.mutateAsync({
        kind: "design",
        title: title.trim(),
        lab: "design3d",
        emoji: template.emoji,
        data: { template: template.slug, color: color.slug, colorValue: color.value, size: size.slug },
        isPublic: true,
      });
      setSaved(true);
      setReward(true);
      setTimeout(() => setReward(false), 3500);
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <StemHeader emoji="🧊" title={t("kids.stem.lab.design3d.title")} subtitle={t("kids.stem.lab.design3d.subtitle")} />
      <StemRewardBanner show={reward} message={t("kids.stem.design.savedMsg")} xp={20} coins={10} />

      {/* Preview */}
      <div className="mt-5 grid place-items-center rounded-2xl border-2 border-border p-8" style={{ perspective: 800 }}>
        <motion.div
          className="grid h-40 w-40 place-items-center rounded-3xl shadow-lg"
          style={{ background: `linear-gradient(145deg, ${color.value}, ${color.value}cc)`, transformStyle: "preserve-3d" }}
          animate={spin && !reduced ? { rotateY: [0, 360] } : { rotateY: 0 }}
          transition={{ duration: 6, repeat: spin && !reduced ? Infinity : 0, ease: "linear" }}
        >
          <span style={{ fontSize: `${size.scale * 4}rem` }} aria-hidden="true">{template.emoji}</span>
        </motion.div>
      </div>

      {/* Template picker */}
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">{t("kids.stem.design.pickModel")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DESIGN_TEMPLATES.map((tpl) => (
            <button key={tpl.slug} type="button" onClick={() => setTemplate(tpl)} aria-pressed={template.slug === tpl.slug}
              className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${template.slug === tpl.slug ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
              <span aria-hidden="true">{tpl.emoji}</span> {t(tpl.labelKey)}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Color picker */}
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">{t("kids.stem.design.pickColor")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DESIGN_COLORS.map((c) => (
            <button key={c.slug} type="button" onClick={() => setColor(c)} aria-pressed={color.slug === c.slug}
              aria-label={t(`kids.stem.color.${c.slug}`)}
              className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${color.slug === c.slug ? "border-foreground ring-2 ring-kids-primary" : "border-border"}`}
              style={{ backgroundColor: c.value }} />
          ))}
        </div>
      </fieldset>

      {/* Size + spin */}
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">{t("kids.stem.design.pickSize")}</legend>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {SIZES.map((s) => (
            <button key={s.slug} type="button" onClick={() => setSize(s)} aria-pressed={size.slug === s.slug}
              className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${size.slug === s.slug ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
              {t(`kids.stem.design.size.${s.slug}`)}
            </button>
          ))}
          <button type="button" onClick={() => setSpin((v) => !v)} aria-pressed={spin}
            className="ms-auto rounded-full border-2 border-border px-3 py-1.5 text-sm font-semibold hover:border-kids-primary/50">
            {spin ? t("kids.stem.design.stopSpin") : t("kids.stem.design.spin")}
          </button>
        </div>
      </fieldset>

      {/* Save */}
      <div className="mt-6 rounded-2xl border-2 border-border bg-card p-4">
        {user ? (
          <div className="flex flex-wrap items-center gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
              placeholder={t("kids.stem.design.namePlaceholder")}
              className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2" />
            <button type="button" onClick={save} disabled={!title.trim() || saveProject.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
              <Save className="h-4 w-4" aria-hidden="true" /> {t("kids.stem.design.save")}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("kids.stem.signInHint")}</p>
        )}
        {saved && <p className="mt-2 text-sm font-semibold text-kids-green">✅ {t("kids.stem.design.savedToGallery")}</p>}
      </div>
    </div>
  );
}
