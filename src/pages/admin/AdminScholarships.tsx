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

const CATEGORY_OPTIONS: Array<{ value: AcademyScholarshipCategory; label: string }> = [
  { value: "government", label: "حكومية" }, { value: "university", label: "جامعية" },
  { value: "private", label: "خاصة" }, { value: "research_grant", label: "منح بحثية" },
  { value: "exchange_program", label: "برامج تبادل" }, { value: "international", label: "دولية" },
  { value: "local", label: "محلية" }, { value: "online", label: "عبر الإنترنت" },
];

export default function AdminScholarships() {
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
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="العودة إلى لوحة التحكم"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <GraduationCap className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-3xl font-bold flex-1">المنح الدراسية</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" aria-hidden="true" />إضافة منحة</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>منحة جديدة</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المنحة" className="rounded-xl" />
                <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="الجهة المانحة" className="rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="البلد" className="rounded-xl" />
                  <Input value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="الدرجة العلمية" className="rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={category} onValueChange={(v) => setCategory(v as AcademyScholarshipCategory)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={fundingLevel} onValueChange={(v) => setFundingLevel(v as AcademyScholarshipFundingLevel)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">تمويل كامل</SelectItem>
                      <SelectItem value="partial">تمويل جزئي</SelectItem>
                      <SelectItem value="tuition_only">الرسوم فقط</SelectItem>
                      <SelectItem value="stipend_only">راتب شهري فقط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="rounded-xl" />
                <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="الموقع الرسمي" className="rounded-xl" />
                <TagInput values={studyFields} onChange={setStudyFields} placeholder="أضف مجال دراسة" />
              </div>
              <DialogFooter><Button onClick={handleCreate} disabled={!title.trim()}>إنشاء</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العنوان</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>البلد</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scholarships.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد منح بعد. أضف أول منحة.</TableCell></TableRow>
                )}
                {scholarships.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium max-w-[220px] truncate">{s.title}</TableCell>
                    <TableCell><Badge variant="secondary">{CATEGORY_OPTIONS.find((c) => c.value === s.category)?.label}</Badge></TableCell>
                    <TableCell>{s.country}</TableCell>
                    <TableCell>{s.status}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => { deleteScholarshipLocal(s.id); reload(); }} aria-label="حذف">
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
