import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type DbProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  points: number;
  category: string;
  store_type: string;
  image: string;
  rating: number;
  in_stock: boolean;
};

const emptyProduct: Omit<DbProduct, "id"> = {
  name: "",
  description: "",
  price: 0,
  points: 0,
  category: "General",
  store_type: "general",
  image: "📦",
  rating: 0,
  in_stock: true,
};

export default function AdminProducts() {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [editing, setEditing] = useState<DbProduct | null>(null);
  const [formData, setFormData] = useState(emptyProduct);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (data) setProducts(data as DbProduct[]);
  };

  useEffect(() => { load(); }, []);

  const validate = (): string | null => {
    if (!formData.name.trim()) return "اسم المنتج مطلوب";
    if (formData.price < 0) return "السعر لا يمكن أن يكون سالباً";
    if (formData.points < 0) return "النقاط لا يمكن أن تكون سالبة";
    if (formData.rating < 0 || formData.rating > 5) return "التقييم يجب أن يكون بين 0 و 5";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setLoading(true);
    if (editing) {
      const { error } = await supabase.from("products").update(formData).eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("تم تحديث المنتج");
    } else {
      // Auto-enrich new products with AI
      try {
        toast.info("الذكاء الاصطناعي يُحسّن بيانات المنتج...");
        const { data: enriched, error: enrichError } = await supabase.functions.invoke("enrich-product", {
          body: { name: formData.name, category: formData.category, store_type: formData.store_type, description: formData.description },
        });
        if (!enrichError && enriched) {
          const enrichedData = {
            ...formData,
            description: formData.description || enriched.description || formData.description,
            category: enriched.category_suggestion || formData.category,
          };
          const { error } = await supabase.from("products").insert(enrichedData);
          if (error) toast.error(error.message);
          else toast.success("تم إنشاء المنتج مع تحسينات الذكاء الاصطناعي!");
        } else {
          const { error } = await supabase.from("products").insert(formData);
          if (error) toast.error(error.message);
          else toast.success("تم إنشاء المنتج");
        }
      } catch {
        const { error } = await supabase.from("products").insert(formData);
        if (error) toast.error(error.message);
        else toast.success("تم إنشاء المنتج");
      }
    }
    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    setFormData(emptyProduct);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); load(); }
  };

  const openEdit = (p: DbProduct) => {
    setEditing(p);
    setFormData({ name: p.name, description: p.description, price: p.price, points: p.points, category: p.category, store_type: p.store_type, image: p.image, rating: p.rating, in_stock: p.in_stock });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setFormData(emptyProduct);
    setDialogOpen(true);
  };

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <h1 className="text-3xl font-bold">إدارة المنتجات</h1>
          </div>
          <Button onClick={openNew}><Plus className="me-2 h-4 w-4" /> إضافة منتج</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الأيقونة</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>النقاط</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>المتجر</TableHead>
                  <TableHead>المخزون</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-2xl">{p.image}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.price.toLocaleString()} VX</TableCell>
                    <TableCell>{p.points}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell>{p.store_type}</TableCell>
                    <TableCell>{p.in_stock ? "✅" : "❌"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
              <DialogTitle>{editing ? "تعديل المنتج" : "منتج جديد"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>الاسم *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="اسم المنتج..." /></div>
              <div><Label>الوصف</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="وصف المنتج..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>السعر (VX)</Label><Input type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>النقاط</Label><Input type="number" min="0" value={formData.points} onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>الفئة</Label><Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} /></div>
                <div>
                  <Label>نوع المتجر</Label>
                  <Select value={formData.store_type} onValueChange={(v) => setFormData({ ...formData, store_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">عام</SelectItem>
                      <SelectItem value="accessibility">إمكانية وصول</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>الأيقونة (إيموجي)</Label><Input value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} /></div>
                <div><Label>التقييم (0-5)</Label><Input type="number" step="0.1" min="0" max="5" value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.in_stock} onCheckedChange={(v) => setFormData({ ...formData, in_stock: v })} />
                <Label>متوفر في المخزون</Label>
              </div>
              <Button onClick={handleSave} disabled={loading || !formData.name.trim()} className="w-full">
                {loading ? "جاري الحفظ..." : editing ? "تحديث المنتج" : "إنشاء المنتج"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </Layout>
  );
}
