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

type DbContent = {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  level: string;
  points: number;
  duration: number;
  extra_label: string | null;
  extra_value: number | null;
  published: boolean;
};

const emptyContent: Omit<DbContent, "id"> = {
  title: "", description: "", type: "article", category: "Article", level: "Beginner",
  points: 0, duration: 0, extra_label: null, extra_value: null, published: true,
};

export default function AdminContent() {
  const [items, setItems] = useState<DbContent[]>([]);
  const [editing, setEditing] = useState<DbContent | null>(null);
  const [formData, setFormData] = useState(emptyContent);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("content_items").select("*").order("created_at", { ascending: false });
    if (data) setItems(data as DbContent[]);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setLoading(true);
    const payload = { ...formData, extra_label: formData.extra_label || null, extra_value: formData.extra_value || null };
    if (editing) {
      const { error } = await supabase.from("content_items").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("Content updated");
    } else {
      const { error } = await supabase.from("content_items").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Content created");
    }
    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    setFormData(emptyContent);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this content?")) return;
    const { error } = await supabase.from("content_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const openEdit = (item: DbContent) => {
    setEditing(item);
    setFormData({ title: item.title, description: item.description, type: item.type, category: item.category, level: item.level, points: item.points, duration: item.duration, extra_label: item.extra_label, extra_value: item.extra_value, published: item.published });
    setDialogOpen(true);
  };

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <h1 className="text-3xl font-bold">Manage Content</h1>
          </div>
          <Button onClick={() => { setEditing(null); setFormData(emptyContent); setDialogOpen(true); }}>
            <Plus className="me-2 h-4 w-4" /> Add Content
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{item.title}</TableCell>
                    <TableCell><Badge variant="secondary">{item.type}</Badge></TableCell>
                    <TableCell>{item.level}</TableCell>
                    <TableCell>{item.points}</TableCell>
                    <TableCell>{item.published ? "✅" : "❌"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Content" : "New Content"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course">Course</SelectItem>
                      <SelectItem value="article">Article</SelectItem>
                      <SelectItem value="podcast">Podcast</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Level</Label>
                  <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Category</Label><Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} /></div>
                <div><Label>Points</Label><Input type="number" value={formData.points} onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Duration (min)</Label><Input type="number" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>Extra Label</Label><Input value={formData.extra_label ?? ""} onChange={(e) => setFormData({ ...formData, extra_label: e.target.value || null })} placeholder="e.g. lessons, episodes" /></div>
              </div>
              {formData.extra_label && (
                <div><Label>Extra Value</Label><Input type="number" value={formData.extra_value ?? 0} onChange={(e) => setFormData({ ...formData, extra_value: parseInt(e.target.value) || null })} /></div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={formData.published} onCheckedChange={(v) => setFormData({ ...formData, published: v })} />
                <Label>Published</Label>
              </div>
              <Button onClick={handleSave} disabled={loading || !formData.title} className="w-full">
                {loading ? "Saving..." : editing ? "Update Content" : "Create Content"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </Layout>
  );
}
