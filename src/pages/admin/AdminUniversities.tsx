import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Landmark, Plus, Trash2 } from "lucide-react";
import { TagInput } from "@/components/academy/ui/TagInput";
import {
  getAllUniversitiesLocal, createUniversityLocal, deleteUniversityLocal,
} from "@/lib/academy/universityLocalStore";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AdminUniversities() {
  const { t } = useLanguage();
  const [universities, setUniversities] = useState(getAllUniversitiesLocal());
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [rankingGlobal, setRankingGlobal] = useState("");
  const [programs, setPrograms] = useState<string[]>([]);
  const [degreesOffered, setDegreesOffered] = useState<string[]>([]);

  const reload = () => setUniversities(getAllUniversitiesLocal());

  const resetForm = () => {
    setName(""); setCountry(""); setCity(""); setDescription(""); setWebsiteUrl("");
    setRankingGlobal(""); setPrograms([]); setDegreesOffered([]);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    createUniversityLocal({
      name, country, city: city || null, description: description || null, website_url: websiteUrl || null,
      ranking_global: rankingGlobal ? Number(rankingGlobal) : null, programs, degrees_offered: degreesOffered,
    });
    resetForm();
    setOpen(false);
    reload();
  };

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label={t("admin.universities.back")}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <Landmark className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-3xl font-bold flex-1">{t("admin.universities.title")}</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" aria-hidden="true" />{t("admin.universities.addUniversity")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t("admin.universities.dialogTitle")}</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("admin.universities.namePlaceholder")} className="rounded-xl" />
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("admin.universities.descriptionPlaceholder")} className="rounded-xl min-h-20" />
                <div className="grid grid-cols-2 gap-3">
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t("admin.universities.countryPlaceholder")} className="rounded-xl" />
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("admin.universities.cityPlaceholder")} className="rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" value={rankingGlobal} onChange={(e) => setRankingGlobal(e.target.value)} placeholder={t("admin.universities.rankingPlaceholder")} className="rounded-xl" />
                  <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder={t("admin.universities.websitePlaceholder")} className="rounded-xl" />
                </div>
                <TagInput values={programs} onChange={setPrograms} placeholder={t("admin.universities.programsPlaceholder")} />
                <TagInput values={degreesOffered} onChange={setDegreesOffered} placeholder={t("admin.universities.degreesPlaceholder")} />
              </div>
              <DialogFooter><Button onClick={handleCreate} disabled={!name.trim()}>{t("admin.universities.create")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.universities.col.name")}</TableHead>
                  <TableHead>{t("admin.universities.col.country")}</TableHead>
                  <TableHead>{t("admin.universities.col.ranking")}</TableHead>
                  <TableHead>{t("admin.universities.col.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {universities.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("admin.universities.empty")}</TableCell></TableRow>
                )}
                {universities.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium max-w-[220px] truncate">{u.name}</TableCell>
                    <TableCell>{u.country}</TableCell>
                    <TableCell>{u.ranking_global ?? "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => { deleteUniversityLocal(u.id); reload(); }} aria-label={t("admin.universities.delete")}>
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
