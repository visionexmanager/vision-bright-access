import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Library, Plus, Trash2 } from "lucide-react";
import { TagInput } from "@/components/academy/ui/TagInput";
import { ResourceTypeBadge } from "@/components/academy/library/ResourceTypeBadge";
import {
  getAllResourcesLocal, createResourceLocal, deleteResourceLocal,
} from "@/lib/academy/libraryLocalStore";
import type { AcademyLibraryResourceType, AcademyResourceDifficulty } from "@/lib/types/academy-modules";

const TYPE_OPTIONS: Array<{ value: AcademyLibraryResourceType; label: string }> = [
  { value: "pdf", label: "PDF" }, { value: "book", label: "كتاب" }, { value: "ebook", label: "كتاب إلكتروني" },
  { value: "audiobook", label: "كتاب صوتي" }, { value: "research_paper", label: "بحث علمي" },
  { value: "scientific_article", label: "مقالة علمية" }, { value: "presentation", label: "عرض تقديمي" },
  { value: "document", label: "مستند" }, { value: "template", label: "قالب تعليمي" }, { value: "worksheet", label: "ورقة عمل" },
  { value: "study_guide", label: "دليل دراسي" }, { value: "exam_collection", label: "مجموعة امتحانات" },
  { value: "practice_material", label: "مواد تدريبية" }, { value: "cheat_sheet", label: "ورقة مرجعية" },
  { value: "infographic", label: "إنفوجرافيك" },
];

export default function AdminLibraryResources() {
  const [resources, setResources] = useState(getAllResourcesLocal());
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AcademyLibraryResourceType>("pdf");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("العربية");
  const [author, setAuthor] = useState("");
  const [difficulty, setDifficulty] = useState<AcademyResourceDifficulty>("beginner");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const reload = () => setResources(getAllResourcesLocal());

  const resetForm = () => {
    setTitle(""); setDescription(""); setType("pdf"); setCategory(""); setLanguage("العربية");
    setAuthor(""); setDifficulty("beginner"); setUrl(""); setTags([]);
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    createResourceLocal({ title, description, type, category, language, author: author || null, difficulty, url, tags });
    resetForm();
    setOpen(false);
    reload();
  };

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="العودة إلى لوحة التحكم"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <Library className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-3xl font-bold flex-1">موارد المكتبة الرقمية</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" aria-hidden="true" />إضافة مورد</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>مورد جديد</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" className="rounded-xl" />
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="الوصف" className="rounded-xl min-h-20" />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={type} onValueChange={(v) => setType(v as AcademyLibraryResourceType)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as AcademyResourceDifficulty)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">مبتدئ</SelectItem>
                      <SelectItem value="intermediate">متوسط</SelectItem>
                      <SelectItem value="advanced">متقدّم</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="الفئة" className="rounded-xl" />
                  <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="اللغة" className="rounded-xl" />
                </div>
                <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="المؤلف (اختياري)" className="rounded-xl" />
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="رابط الملف" className="rounded-xl" />
                <TagInput values={tags} onChange={setTags} placeholder="أضف وسماً" />
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!title.trim()}>إنشاء</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العنوان</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>المشاهدات</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد موارد بعد. أضف أول مورد للمكتبة.</TableCell></TableRow>
                )}
                {resources.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium max-w-[220px] truncate">{r.title}</TableCell>
                    <TableCell><ResourceTypeBadge type={r.type} /></TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell>{r.views_count.toLocaleString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => { deleteResourceLocal(r.id); reload(); }} aria-label="حذف">
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
