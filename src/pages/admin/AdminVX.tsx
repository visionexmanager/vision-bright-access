import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Coins, TrendingUp, TrendingDown, ArrowLeft, History, User } from "lucide-react";
import { Link } from "react-router-dom";

type LogEntry = {
  email: string;
  points: number;
  reason: string;
  display_name: string;
  new_balance: number;
  ts: string;
};

export default function AdminVX() {
  const [email, setEmail]   = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ name: string; balance: number } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const isGrant  = !amount.startsWith("-") && amount !== "";
  const isRevoke = amount.startsWith("-");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const pts = parseInt(amount);
    if (!email.trim() || isNaN(pts) || pts === 0) {
      toast.error("أدخل إيميل وقيمة صحيحة (موجبة للمنح، سالبة للسحب)");
      return;
    }

    setLoading(true);
    setLastResult(null);

    const { data, error } = await supabase.rpc("admin_adjust_vx", {
      p_email:  email.trim().toLowerCase(),
      p_points: pts,
      p_reason: reason.trim() || null,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row?.success) {
      toast.error(row?.message ?? "حدث خطأ");
      return;
    }

    setLastResult({ name: row.user_display_name ?? email, balance: Number(row.new_balance) });
    toast.success(pts > 0 ? `تم منح ${pts.toLocaleString()} VX` : `تم سحب ${Math.abs(pts).toLocaleString()} VX`);

    // Add to session log
    setLog(prev => [{
      email: email.trim(),
      points: pts,
      reason: reason.trim() || (pts > 0 ? "Admin grant" : "Admin deduction"),
      display_name: row.user_display_name ?? "—",
      new_balance: Number(row.new_balance),
      ts: new Date().toLocaleTimeString(),
    }, ...prev].slice(0, 20));

    // Reset form
    setEmail(""); setAmount(""); setReason("");
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/admin" aria-label="العودة للأدمن">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-500/10">
            <Coins className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">إدارة VX</h1>
            <p className="text-sm text-muted-foreground">منح أو سحب عملات VX بحسب الإيميل</p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تعديل رصيد مستخدم</CardTitle>
            <CardDescription>أدخل إيميل المستخدم والقيمة — موجبة للمنح، سالبة للسحب</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">

              <div className="space-y-1.5">
                <Label htmlFor="vx-email">إيميل المستخدم</Label>
                <Input
                  id="vx-email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vx-amount">
                  القيمة{" "}
                  <span className="text-xs text-muted-foreground">(موجبة = منح • سالبة = سحب)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="vx-amount"
                    type="number"
                    placeholder="مثال: 500 أو -200"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                    dir="ltr"
                    className={`ps-10 ${isGrant ? "border-green-500/50" : isRevoke ? "border-red-500/50" : ""}`}
                  />
                  <span className="absolute start-3 top-1/2 -translate-y-1/2">
                    {isGrant  ? <TrendingUp  className="h-4 w-4 text-green-500" /> :
                     isRevoke ? <TrendingDown className="h-4 w-4 text-red-500"  /> :
                                <Coins className="h-4 w-4 text-muted-foreground" />}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vx-reason">السبب <span className="text-xs text-muted-foreground">(اختياري)</span></Label>
                <Textarea
                  id="vx-reason"
                  placeholder="مثال: مكافأة على المشاركة في الفعالية..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className={`w-full text-base font-semibold ${isRevoke ? "bg-red-600 hover:bg-red-700" : ""}`}
              >
                <Coins className="me-2 h-4 w-4" />
                {loading ? "جارٍ التنفيذ..." :
                 isRevoke ? `سحب ${Math.abs(parseInt(amount) || 0).toLocaleString()} VX` :
                 isGrant  ? `منح ${(parseInt(amount) || 0).toLocaleString()} VX` :
                 "تنفيذ"}
              </Button>
            </form>

            {/* Result card */}
            {lastResult && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
                <User className="h-8 w-8 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold">{lastResult.name}</p>
                  <p className="text-sm text-muted-foreground">
                    الرصيد الجديد:{" "}
                    <span className="font-bold text-yellow-500">
                      {lastResult.balance.toLocaleString()} VX
                    </span>
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session log */}
        {log.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" /> سجل الجلسة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {log.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{entry.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{entry.email}</p>
                      {entry.reason && (
                        <p className="text-xs text-muted-foreground/70 truncate">{entry.reason}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge
                        variant={entry.points > 0 ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {entry.points > 0 ? "+" : ""}{entry.points.toLocaleString()} VX
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        رصيد: {entry.new_balance.toLocaleString()} • {entry.ts}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
