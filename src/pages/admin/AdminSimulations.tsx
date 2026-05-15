import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

type DbSim = {
  id: string; title: string; slug: string; description: string;
  difficulty: string; subcategory: string; points: number;
  estimated_duration: number; sort_order: number; published: boolean;
};
const emptySim: Omit<DbSim, "id"> = {
  title: "", slug: "", description: "", difficulty: "medium",
  subcategory: "", points: 50, estimated_duration: 15, sort_order: 0, published: true,
};

export default function AdminSimulations() {
  const { t } = useLanguage();
  const [items, setItems] = useState<DbSim[]>([]);
  const [completions, setCompletions] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<DbSim | null>(null);
  const [formData, setFormData] = useState(emptySim);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("simulations").select("*").order("sort_order");
    if (data) setItems(data as DbSim[]);
    const { data: prog } = await supabase.from("simulation_progress").select("simulation_id").eq("completed", true);
    if (prog) {
      const counts: Record<string, number> = {};
      prog.forEach((r) => { counts[r.simulation_id] = (counts[r.simulation_id] ?? 0) + 1; });
      setCompletions(counts);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.slug.trim()) { toast.error(t("admin.simulations.validation")); return; }
    setLoading(true);
    const payload = { ...formData, slug: formData.slug.toLowerCase().replace(/\s+/g, "-") };
    if (editing) {
      const { error } = await supabase.from("simulations").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message); else toast.success(t("admin.simulations.updated"));
    } else {
      const { error } = await supabase.from("simulations").insert(payload);
      if (error) toast.error(error.message); else toast.success(t("admin.simulations.created"));
    }
    setLoading(false); setDialogOpen(false); setEditing(null); setFormData(emptySim); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin.simulations.deleteConfirm"))) return;
    const { error } = await supabase.from("simulations").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success(t("admin.common.deleted")); load(); }
  };

  const openEdit = (s: DbSim) => {
    setEditing(s);
    setFormData({ title: s.title, slug: s.slug, description: s.description, difficulty: s.difficulty, subcategory: s.subcategory, points: s.points, estimated_duration: s.estimated_duration, sort_order: s.sort_order, published: s.published });
    setDialogOpen(true);
  };

  const difficultyColor = (d: string) => d === "easy" ? "bg-green-500/10 text-green-600" : d === "hard" ? "bg-red-500/10 text-red-600" : "bg-yellow-500/10 text-yellow-600";

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <h1 className="text-3xl font-bold">{t("admin.simulations.title")}</h1>
          </div>
          <Button onClick={() => { setEditing(null); setFormData(emptySim); setDialogOpen(true); }}>
            <Plus className="me-2 h-4 w-4" /> {t("admin.simulations.add")}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.simulations.field.title")}</TableHead>
                  <TableHead>{t("admin.simulations.field.slug")}</TableHead>
                  <TableHead>{t("admin.simulations.field.difficulty")}</TableHead>
                  <TableHead>{t("admin.simulations.field.points")}</TableHead>
                  <TableHead>{t("admin.simulations.completions")}</TableHead>
                  <TableHead>{t("admin.simulations.field.published")}</TableHead>
                  <TableHead>{t("admin.common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium max-w-[180px] truncate">{s.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.slug}</TableCell>
                    <TableCell><Badge className={difficultyColor(s.difficulty)}>{t(`admin.simulations.difficulty.${s.difficulty}`)}</Badge></TableCell>
                    <TableCell>{s.points}</TableCell>
                    <TableCell>{completions[s.id] ?? 0}</TableCell>
                    <TableCell>{s.published ? "✓" : "×"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={t("admin.common.edit")}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} aria-label={t("admin.common.delete")}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>{editing ? t("admin.simulations.edit") : t("admin.simulations.new")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t("admin.simulations.field.title")}</Label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder={t("admin.simulations.titlePlaceholder")} /></div>
              <div><Label>{t("admin.simulations.field.slug")}</Label><Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder={t("admin.simulations.slugPlaceholder")} dir="ltr" /></div>
              <div><Label>{t("admin.simulations.field.description")}</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t("admin.simulations.field.difficulty")}</Label>
                  <Select value={formData.difficulty} onValueChange={(v) => setFormData({ ...formData, difficulty: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">{t("admin.simulations.difficulty.easy")}</SelectItem>
                      <SelectItem value="medium">{t("admin.simulations.difficulty.medium")}</SelectItem>
                      <SelectItem value="hard">{t("admin.simulations.difficulty.hard")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t("admin.simulations.field.subcategory")}</Label><Input value={formData.subcategory} onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>{t("admin.simulations.field.points")}</Label><Input type="number" min="0" value={formData.points} onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>{t("admin.simulations.field.duration")}</Label><Input type="number" min="1" value={formData.estimated_duration} onChange={(e) => setFormData({ ...formData, estimated_duration: parseInt(e.target.value) || 1 })} /></div>
                <div><Label>{t("admin.simulations.field.sortOrder")}</Label><Input type="number" min="0" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={formData.published} onCheckedChange={(v) => setFormData({ ...formData, published: v })} /><Label>{t("admin.simulations.field.published")}</Label></div>
              <Button onClick={handleSave} disabled={loading || !formData.title.trim() || !formData.slug.trim()} className="w-full">
                {loading ? t("admin.settings.saving") : editing ? t("admin.simulations.update") : t("admin.simulations.create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </Layout>
  );
}
