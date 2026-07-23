import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useBecomeAuthor } from "@/hooks/library/useBecomeAuthor";
import { useBookWizard, type WizardFormat } from "@/hooks/library/useBookWizard";
import { fetchCategories, fetchPublishers } from "@/services/library/catalog";
import { queryKeys } from "@/lib/api/queryKeys";
import type { LibraryContentFormat, LibraryLicenseType, LibraryAgeRating, LibraryPricingModel } from "@/lib/types/library-studio";

const FORMATS: WizardFormat[] = ["pdf", "epub", "docx", "txt", "html", "markdown", "audiobook", "interactive"];
const CONTENT_FORMATS: LibraryContentFormat[] = ["novel", "educational", "scientific", "research", "magazine", "comic", "children", "cookbook", "documentation", "manual", "interactive", "audiobook"];
const LICENSES: LibraryLicenseType[] = ["copyright", "creative_commons", "public_domain", "custom"];
const AGE_RATINGS: LibraryAgeRating[] = ["all", "7+", "12+", "16+", "18+"];
const PRICING_MODELS: LibraryPricingModel[] = ["free", "paid", "subscription", "rental", "donation", "bundle"];

export default function LibraryStudioBookWizard() {
  const { t } = useLanguage();
  useDocumentHead({ title: t("library.studio.wizard.title") });

  const { authorProfile } = useBecomeAuthor();
  const { submit, isSubmitting } = useBookWizard();

  const { data: categories = [] } = useQuery({ queryKey: queryKeys.library.categories(), queryFn: fetchCategories });
  const { data: publishers = [] } = useQuery({ queryKey: ["library", "publishers"], queryFn: fetchPublishers });

  const [format, setFormat] = useState<WizardFormat>("epub");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("en");
  const [categoryId, setCategoryId] = useState<string>("");
  const [isbn, setIsbn] = useState("");
  const [edition, setEdition] = useState("");
  const [publisherId, setPublisherId] = useState<string>("");
  const [publishedDate, setPublishedDate] = useState("");
  const [ageRating, setAgeRating] = useState<LibraryAgeRating>("all");
  const [contentFormat, setContentFormat] = useState<LibraryContentFormat | "">("");
  const [licenseType, setLicenseType] = useState<LibraryLicenseType>("copyright");
  const [pricingModel, setPricingModel] = useState<LibraryPricingModel>("paid");
  const [priceUsd, setPriceUsd] = useState("");

  const needsFile = format === "pdf" || format === "epub";

  const handleSubmit = async () => {
    if (!authorProfile || !title.trim() || !description.trim()) return;
    await submit({
      format,
      file: file ?? undefined,
      author_id: authorProfile.id,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      description: description.trim(),
      language,
      category_id: categoryId || undefined,
      book_type: format === "audiobook" ? "audiobook" : "ebook",
      content_format: contentFormat || undefined,
      isbn: isbn.trim() || undefined,
      edition: edition.trim() || undefined,
      publisher_id: publisherId || undefined,
      published_date: publishedDate || undefined,
      age_rating: ageRating,
      license_type: licenseType,
      pricing_model: pricingModel,
      is_free: pricingModel === "free" || pricingModel === "donation",
      price_usd: priceUsd ? Number(priceUsd) : undefined,
    });
  };

  if (!authorProfile) return null;

  return (
    <Layout>
      <LibraryLayout title={t("library.studio.wizard.title")}>
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-bold">{t("library.studio.wizard.title")}</h1>
          </div>

          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">{t("library.studio.wizard.formatSection")}</h2>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as WizardFormat)} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FORMATS.map((f) => (
                <div key={f} className="flex items-center gap-2 rounded-md border p-2">
                  <RadioGroupItem value={f} id={`format-${f}`} />
                  <Label htmlFor={`format-${f}`} className="cursor-pointer text-sm">{t(`library.studio.wizard.format.${f}`)}</Label>
                </div>
              ))}
            </RadioGroup>
            {needsFile && (
              <div>
                <Label htmlFor="manuscript-file">{t("library.studio.wizard.uploadManuscript")}</Label>
                <Input id="manuscript-file" type="file" accept={format === "pdf" ? "application/pdf" : "application/epub+zip"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            )}
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">{t("library.studio.wizard.metadataSection")}</h2>
            <div>
              <Label htmlFor="wizard-title">{t("library.studio.wizard.titleLabel")}</Label>
              <Input id="wizard-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="wizard-subtitle">{t("library.studio.wizard.subtitleLabel")}</Label>
              <Input id="wizard-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="wizard-description">{t("library.studio.wizard.descriptionLabel")}</Label>
              <Textarea id="wizard-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="wizard-language">{t("library.studio.wizard.languageLabel")}</Label>
                <Input id="wizard-language" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="en" />
              </div>
              <div>
                <Label>{t("library.studio.wizard.categoryLabel")}</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger aria-label={t("library.studio.wizard.categoryLabel")}><SelectValue placeholder={t("library.studio.wizard.categoryLabel")} /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("library.studio.wizard.contentFormatLabel")}</Label>
              <Select value={contentFormat} onValueChange={(v) => setContentFormat(v as LibraryContentFormat)}>
                <SelectTrigger aria-label={t("library.studio.wizard.contentFormatLabel")}><SelectValue placeholder={t("library.studio.wizard.contentFormatLabel")} /></SelectTrigger>
                <SelectContent>
                  {CONTENT_FORMATS.map((cf) => <SelectItem key={cf} value={cf}>{t(`library.studio.bookType.${cf}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="wizard-isbn">{t("library.studio.wizard.isbnLabel")}</Label>
                <Input id="wizard-isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="wizard-edition">{t("library.studio.wizard.editionLabel")}</Label>
                <Input id="wizard-edition" value={edition} onChange={(e) => setEdition(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("library.studio.wizard.publisherLabel")}</Label>
                <Select value={publisherId} onValueChange={setPublisherId}>
                  <SelectTrigger aria-label={t("library.studio.wizard.publisherLabel")}><SelectValue placeholder={t("library.studio.wizard.publisherLabel")} /></SelectTrigger>
                  <SelectContent>
                    {publishers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="wizard-published-date">{t("library.studio.wizard.publicationDateLabel")}</Label>
                <Input id="wizard-published-date" type="date" value={publishedDate} onChange={(e) => setPublishedDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t("library.studio.wizard.ageRatingLabel")}</Label>
              <Select value={ageRating} onValueChange={(v) => setAgeRating(v as LibraryAgeRating)}>
                <SelectTrigger aria-label={t("library.studio.wizard.ageRatingLabel")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AGE_RATINGS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">{t("library.studio.wizard.pricingLicensingSection")}</h2>
            <div>
              <Label>{t("library.studio.wizard.pricingModelLabel")}</Label>
              <Select value={pricingModel} onValueChange={(v) => setPricingModel(v as LibraryPricingModel)}>
                <SelectTrigger aria-label={t("library.studio.wizard.pricingModelLabel")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICING_MODELS.map((p) => <SelectItem key={p} value={p}>{t(`library.studio.pricingModel.${p}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(pricingModel === "paid" || pricingModel === "rental") && (
              <div>
                <Label htmlFor="wizard-price-usd">{t("library.studio.wizard.priceUsdLabel")}</Label>
                <Input id="wizard-price-usd" type="number" min="0" step="0.01" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} />
              </div>
            )}
            <div>
              <Label>{t("library.studio.wizard.licenseLabel")}</Label>
              <Select value={licenseType} onValueChange={(v) => setLicenseType(v as LibraryLicenseType)}>
                <SelectTrigger aria-label={t("library.studio.wizard.licenseLabel")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LICENSES.map((l) => <SelectItem key={l} value={l}>{t(`library.studio.license.${l}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Button onClick={() => void handleSubmit()} disabled={isSubmitting || !title.trim() || !description.trim() || (needsFile && !file)} className="w-full" size="lg">
            {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t("library.studio.wizard.createBook")}
          </Button>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
