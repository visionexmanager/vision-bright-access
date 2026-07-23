import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, PenLine } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useBecomeAuthor } from "@/hooks/library/useBecomeAuthor";
import { toast } from "@/hooks/use-toast";

export default function LibraryBecomeAuthor() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  useDocumentHead({ title: t("library.studio.becomeAuthor.title") });

  const { authorProfile, becomeAuthor } = useBecomeAuthor();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (authorProfile) {
    navigate("/library/studio", { replace: true });
    return null;
  }

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await becomeAuthor({ name: name.trim(), bio: bio.trim() || undefined });
      toast({ title: t("library.studio.becomeAuthor.success") });
      navigate("/library/studio");
    } catch (err) {
      toast({ title: t("library.studio.becomeAuthor.error"), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <LibraryLayout title={t("library.studio.becomeAuthor.title")}>
        <Card className="mx-auto max-w-lg space-y-4 p-6">
          <div className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-lg font-semibold">{t("library.studio.becomeAuthor.title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t("library.studio.becomeAuthor.description")}</p>

          <div>
            <Label htmlFor="author-name">{t("library.studio.becomeAuthor.nameLabel")}</Label>
            <Input id="author-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="author-bio">{t("library.studio.becomeAuthor.bioLabel")}</Label>
            <Textarea id="author-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
          </div>

          <Button onClick={() => void handleSubmit()} disabled={isSubmitting || !name.trim()} className="w-full">
            {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t("library.studio.becomeAuthor.cta")}
          </Button>
        </Card>
      </LibraryLayout>
    </Layout>
  );
}
