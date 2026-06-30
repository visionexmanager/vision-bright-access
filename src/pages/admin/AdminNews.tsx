import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Send, Newspaper, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { CATEGORY_TOPIC } from "@/pages/News";

type Article = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon_name: string;
  published: boolean;
  newsletter_sent: boolean;
  published_at: string | null;
  created_at: string;
};

const EMPTY: Omit<Article, "id" | "created_at" | "newsletter_sent" | "published_at"> = {
  title: "",
  description: "",
  category: "technology",
  icon_name: "Cpu",
  published: false,
};

const CATEGORIES = [
  { value: "technology",    label: "Technology" },
  { value: "ai",            label: "AI & Innovation" },
  { value: "marketplace",   label: "Marketplace" },
  { value: "games",         label: "Games & Entertainment" },
  { value: "academy",       label: "Education & Training" },
  { value: "health",        label: "Health & Medical" },
  { value: "legal",         label: "Legal & Rights" },
  { value: "business",      label: "Business & Economy" },
  { value: "travel",        label: "Travel & Tourism" },
  { value: "beauty",        label: "Beauty & Lifestyle" },
  { value: "sports",        label: "Sports & Fitness" },
  { value: "music",         label: "Music & Arts" },
  { value: "psychology",    label: "Psychology & Mental Health" },
  { value: "community",     label: "Community" },
  { value: "accessibility", label: "Accessibility" },
  { value: "entertainment", label: "Live TV & Radio" },
  { value: "nutrition",     label: "Nutrition & Wellness" },
  { value: "platform",      label: "Platform Updates" },
];

const ICONS = [
  { value: "Cpu",           label: "Technology (CPU)" },
  { value: "Brain",         label: "AI (Brain)" },
  { value: "ShoppingBag",   label: "Marketplace" },
  { value: "Gamepad2",      label: "Games" },
  { value: "GraduationCap", label: "Education" },
  { value: "Heart",         label: "Health" },
  { value: "Scale",         label: "Legal" },
  { value: "TrendingUp",    label: "Business" },
  { value: "Plane",         label: "Travel" },
  { value: "Sparkles",      label: "Beauty" },
  { value: "Trophy",        label: "Sports" },
  { value: "Music",         label: "Music" },
  { value: "SmilePlus",     label: "Psychology" },
  { value: "Globe",         label: "Community" },
  { value: "Accessibility", label: "Accessibility" },
  { value: "Tv",            label: "Entertainment" },
  { value: "Apple",         label: "Nutrition" },
  { value: "Rocket",        label: "Platform" },
  { value: "Newspaper",     label: "General News" },
];

function buildEmailHTML(article: Article): string {
  const catLabel = CATEGORIES.find((c) => c.value === article.category)?.label ?? article.category;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(135deg,#0f766e,#0d9488);padding:32px 32px 24px;">
      <p style="margin:0 0 8px;color:#ccfbf1;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${catLabel} • VisionEx News</p>
      <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">${article.title}</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.75;">${article.description}</p>
      <a href="https://visionex.app/news"
         style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Read More on VisionEx →
      </a>
    </div>
    <div style="padding:24px 32px;border-top:1px solid #f3f4f6;background:#f9fafb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
        You received this because you subscribed to <strong>${catLabel}</strong> news on VisionEx.<br>
        <a href="https://visionex.app/legal" style="color:#0f766e;">Manage subscriptions</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export default function AdminNews() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [sendAfterPublish, setSendAfterPublish] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingDaily, setSendingDaily] = useState(false);

  const sendDailyNewsletter = async () => {
    setSendingDaily(true);
    try {
      const { data, error } = await supabase.functions.invoke("news-generate", {
        body: {},
        headers: { "x-newsletter-only": "true" },
      });
      if (error) throw new Error(error.message);
      const result = data as { emailsSent?: number; note?: string };
      toast.success(result.note ?? `Newsletter sent to ${result.emailsSent ?? 0} subscriber(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send newsletter.");
    }
    setSendingDaily(false);
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("news_articles")
      .select("*")
      .order("created_at", { ascending: false });
    setArticles((data as Article[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setSendAfterPublish(false);
    setDialogOpen(true);
  };

  const openEdit = (a: Article) => {
    setEditing(a);
    setForm({ title: a.title, description: a.description, category: a.category, icon_name: a.icon_name, published: a.published });
    setSendAfterPublish(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    setSaving(true);

    const payload = {
      ...form,
      published_at: form.published ? new Date().toISOString() : null,
    };

    let savedId = editing?.id ?? "";

    if (editing) {
      const { error } = await supabase.from("news_articles").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Article updated.");
    } else {
      const { data, error } = await supabase.from("news_articles").insert(payload).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      savedId = (data as { id: string }).id;
      toast.success("Article created.");
    }

    // Send newsletter if requested and article is published
    if (form.published && sendAfterPublish && savedId) {
      await sendNewsletter({ ...form, id: savedId, newsletter_sent: false, published_at: null, created_at: "" } as Article, savedId);
    }

    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const sendNewsletter = async (article: Article, id: string) => {
    const topic = CATEGORY_TOPIC[article.category] ?? "news-technology";
    setSendingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "newsletter",
          topic,
          subject: `📰 ${article.title}`,
          html: buildEmailHTML(article),
          from: "news",
        },
      });
      if (error) throw new Error(error.message);
      const result = data as { sent: number; failed: number };
      toast.success(`Newsletter sent to ${result.sent} subscriber(s) in "${topic}".`);
      await supabase.from("news_articles").update({ newsletter_sent: true }).eq("id", id);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed.");
    }
    setSendingId(null);
  };

  const togglePublish = async (a: Article) => {
    const next = !a.published;
    const { error } = await supabase
      .from("news_articles")
      .update({ published: next, published_at: next ? new Date().toISOString() : null })
      .eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Article published." : "Article unpublished.");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    const { error } = await supabase.from("news_articles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted.");
    load();
  };

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link to="/admin" aria-label="Back to admin">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
            <Newspaper className="h-7 w-7 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold">News Management</h1>
            <Badge variant="secondary">{articles.length} articles</Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={sendDailyNewsletter}
              disabled={sendingDaily}
            >
              <Send className="me-2 h-4 w-4" />
              {sendingDaily ? "Sending…" : "Send News"}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" /> Add Article
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : articles.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <Newspaper className="h-12 w-12 opacity-30" />
                <p>No articles yet. Create the first one.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Newsletter</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[240px]">
                        <p className="font-medium truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.description}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">{a.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => togglePublish(a)}
                          aria-pressed={a.published}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            a.published
                              ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {a.published ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
                          {a.published ? "Published" : "Draft"}
                        </button>
                      </TableCell>
                      <TableCell>
                        {a.newsletter_sent ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                          </span>
                        ) : a.published ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={sendingId === a.id}
                            onClick={() => sendNewsletter(a, a.id)}
                          >
                            <Send className="me-1 h-3 w-3" />
                            {sendingId === a.id ? "Sending…" : "Send"}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.published_at
                          ? new Date(a.published_at).toLocaleDateString()
                          : new Date(a.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)} aria-label="Edit article">
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(a.id)} aria-label="Delete article">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Article" : "New Article"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="art-title">Title *</Label>
              <Input
                id="art-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Article title"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="art-desc">Description *</Label>
              <Textarea
                id="art-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Article content / summary"
                rows={4}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Icon</Label>
                <Select value={form.icon_name} onValueChange={(v) => setForm({ ...form, icon_name: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICONS.map((ic) => (
                      <SelectItem key={ic.value} value={ic.value}>{ic.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Publish</p>
                <p className="text-xs text-muted-foreground">Make article visible on the news page</p>
              </div>
              <Switch
                checked={form.published}
                onCheckedChange={(v) => setForm({ ...form, published: v })}
              />
            </div>

            {form.published && (
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div>
                  <p className="text-sm font-medium text-primary">Send Newsletter</p>
                  <p className="text-xs text-muted-foreground">
                    Email subscribers of <strong>{CATEGORIES.find((c) => c.value === form.category)?.label}</strong>
                    {" → topic: "}<code className="text-primary">{CATEGORY_TOPIC[form.category] ?? "news-technology"}</code>
                  </p>
                </div>
                <Switch checked={sendAfterPublish} onCheckedChange={setSendAfterPublish} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.description}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
