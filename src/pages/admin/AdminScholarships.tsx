import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, GraduationCap, Plus, Trash2 } from "lucide-react";
import { TagInput } from "@/components/academy/ui/TagInput";
import {
  getAllScholarshipsLocal, createScholarshipLocal, deleteScholarshipLocal,
} from "@/lib/academy/scholarshipLocalStore";
import type { AcademyScholarshipCategory, AcademyScholarshipFundingLevel } from "@/lib/types/academy-modules";
import { useLanguage } from "@/contexts/LanguageContext";

const CATEGORY_OPTIONS: Array<{ value: AcademyScholarshipCategory; labelKey: string }> = [
  { value: "government", labelKey: "admin.scholarships.category.government" }, { value: "university", labelKey: "admin.scholarships.category.university" },
  { value: "private", labelKey: "admin.scholarships.category.private" }, { value: "research_grant", labelKey: "admin.scholarships.category.researchGrant" },
  { value: "exchange_program", labelKey: "admin.scholarships.category.exchangeProgram" }, { value: "international", labelKey: "admin.scholarships.category.international" },
  { value: "local", labelKey: "admin.scholarships.category.local" }, { value: "online", labelKey: "admin.scholarships.category.online" },
];

const FUNDING_LABEL_KEY: Record<AcademyScholarshipFundingLevel, string> = {
  full: "admin.scholarships.funding.full",
  partial: "admin.scholarships.funding.partial",
  tuition_only: "admin.scholarships.funding.tuitionOnly",
  stipend_only: "admin.scholarships.funding.stipendOnly",
};

export default function AdminScholarships() {
  const { t } = useLanguage();
  const [scholarships, setScholarships] = useState(getAllScholarshipsLocal());
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [country, setCountry] = useState("");
  const [degree, setDegree] = useState("");
  const [category, setCategory] = useState<AcademyScholarshipCategory>("government");
  const [fundingLevel, setFundingLevel] = useState<AcademyScholarshipFundingLevel>("partial");
  const [deadline, setDeadline] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [studyFields, setStudyFields] = useState<string[]>([]);

  const reload = () => setScholarships(getAllScholarshipsLocal());

  const resetForm = () => {
    setTitle(""); setProvider(""); setCountry(""); setDegree(""); setCategory("government");
    setFundingLevel("partial"); setDeadline(""); setWebsiteUrl(""); setStudyFields([]);
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    createScholarshipLocal({
      title, provider, country, degree: degree || null, category, funding_level: fundingLevel,
      deadline: deadline || null, website_url: websiteUrl || null, url: websiteUrl || null, study_fields: studyFields,
    });
    resetForm();
    setOpen(false);
    reload();
  };

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label={t("admin.scholarships.back")}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <GraduationCap className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-3xl font-bold flex-1">{t("admin.scholarships.title")}</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" aria-hidden="true" />{t("admin.scholarships.addScholarship")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t("admin.scholarships.newScholarship")}</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("admin.scholarships.form.title")} className="rounded-xl" />
                <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder={t("admin.scholarships.form.provider")} className="rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t("admin.scholarships.form.country")} className="rounded-xl" />
                  <Input value={degree} onChange={(e) => setDegree(e.target.value)} placeholder={t("admin.scholarships.form.degree")} className="rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={category} onValueChange={(v) => setCategory(v as AcademyScholarshipCategory)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={fundingLevel} onValueChange={(v) => setFundingLevel(v as AcademyScholarshipFundingLevel)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">{t(FUNDING_LABEL_KEY.full)}</SelectItem>
                      <SelectItem value="partial">{t(FUNDING_LABEL_KEY.partial)}</SelectItem>
                      <SelectItem value="tuition_only">{t(FUNDING_LABEL_KEY.tuition_only)}</SelectItem>
                      <SelectItem value="stipend_only">{t(FUNDING_LABEL_KEY.stipend_only)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="rounded-xl" />
                <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder={t("admin.scholarships.form.websiteUrl")} className="rounded-xl" />
                <TagInput values={studyFields} onChange={setStudyFields} placeholder={t("admin.scholarships.form.studyFieldPlaceholder")} />
              </div>
              <DialogFooter><Button onClick={handleCreate} disabled={!title.trim()}>{t("admin.scholarships.create")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.scholarships.col.title")}</TableHead>
                  <TableHead>{t("admin.scholarships.col.category")}</TableHead>
                  <TableHead>{t("admin.scholarships.col.country")}</TableHead>
                  <TableHead>{t("admin.scholarships.col.status")}</TableHead>
                  <TableHead>{t("admin.scholarships.col.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scholarships.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("admin.scholarships.empty")}</TableCell></TableRow>
                )}
                {scholarships.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium max-w-[220px] truncate">{s.title}</TableCell>
                    <TableCell><Badge variant="secondary">{t(CATEGORY_OPTIONS.find((c) => c.value === s.category)?.labelKey ?? s.category)}</Badge></TableCell>
                    <TableCell>{s.country}</TableCell>
                    <TableCell>{s.status}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => { deleteScholarshipLocal(s.id); reload(); }} aria-label={t("admin.scholarships.delete")}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
