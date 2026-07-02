import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Trophy, Info } from "lucide-react";
import { useState } from "react";
import { ACHIEVEMENT_CATALOG, MISSION_CATALOG, LEARNING_CARD_CATALOG } from "@/lib/academy/gamificationLocalStore";
import { ACADEMY_RANK_TIERS } from "@/lib/academy/leveling";
import { ACADEMY_XP_RATES } from "@/services/academy/academyService";
import { MISSION_SCOPE_LABELS, TIER_STYLES } from "@/components/academy/gamification/tierStyles";

type Tab = "achievements" | "missions" | "cards" | "ranks" | "xp-rates";

export default function AdminAcademyGamification() {
  const [tab, setTab] = useState<Tab>("achievements");

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin/academy" aria-label="العودة إلى إدارة الأكاديمية"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link></Button>
          <Trophy className="h-6 w-6 text-yellow-500" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-bold">إعدادات التلعيب</h1>
            <p className="text-muted-foreground text-sm">عرض كتالوجات الإنجازات والمهام والمستويات — محتوى ثابت مُضمَّن في التطبيق</p>
          </div>
        </div>

        <div className="mb-6 flex items-start gap-2 p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>هذه الكتالوجات قواعد تصميم ثابتة (نفس مبدأ نظام XP الأصلي) — معروضة للاطلاع فقط في هذه المرحلة؛ تعديلها حالياً يتم عبر الكود مباشرة.</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="achievements">الإنجازات ({ACHIEVEMENT_CATALOG.length})</TabsTrigger>
            <TabsTrigger value="missions">المهام ({MISSION_CATALOG.length})</TabsTrigger>
            <TabsTrigger value="cards">بطاقات التعلّم ({LEARNING_CARD_CATALOG.length})</TabsTrigger>
            <TabsTrigger value="ranks">الرتب ({ACADEMY_RANK_TIERS.length})</TabsTrigger>
            <TabsTrigger value="xp-rates">معدّلات XP ({Object.keys(ACADEMY_XP_RATES).length})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-4 rounded-2xl border border-border overflow-hidden overflow-x-auto">
          {tab === "achievements" && (
            <Table>
              <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>الفئة</TableHead><TableHead>المستوى</TableHead><TableHead>مخفي</TableHead></TableRow></TableHeader>
              <TableBody>
                {ACHIEVEMENT_CATALOG.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{a.category}</TableCell>
                    <TableCell><Badge className={TIER_STYLES[a.tier].text} variant="outline">{TIER_STYLES[a.tier].label}</Badge></TableCell>
                    <TableCell>{a.hidden ? "نعم" : "لا"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab === "missions" && (
            <Table>
              <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>النطاق</TableHead><TableHead>الهدف</TableHead><TableHead>سبب XP</TableHead></TableRow></TableHeader>
              <TableBody>
                {MISSION_CATALOG.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell>{MISSION_SCOPE_LABELS[m.scope]}</TableCell>
                    <TableCell>{m.target_count}</TableCell>
                    <TableCell className="font-mono text-xs">{m.xp_reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab === "cards" && (
            <Table>
              <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>الندرة</TableHead><TableHead>الموضوع</TableHead></TableRow></TableHeader>
              <TableBody>
                {LEARNING_CARD_CATALOG.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>{c.rarity}</TableCell>
                    <TableCell>{c.subject}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab === "ranks" && (
            <Table>
              <TableHeader><TableRow><TableHead>الرتبة</TableHead><TableHead>من مستوى</TableHead><TableHead>إلى مستوى</TableHead></TableRow></TableHeader>
              <TableBody>
                {ACADEMY_RANK_TIERS.map((r) => (
                  <TableRow key={r.rank}>
                    <TableCell className="font-medium">{r.rank}</TableCell>
                    <TableCell>{r.minLevel}</TableCell>
                    <TableCell>{r.maxLevel ?? "بلا حد"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab === "xp-rates" && (
            <Table>
              <TableHeader><TableRow><TableHead>السبب</TableHead><TableHead>XP</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(ACADEMY_XP_RATES).map(([reason, amount]) => (
                  <TableRow key={reason}>
                    <TableCell className="font-mono text-xs">{reason}</TableCell>
                    <TableCell className="font-bold">{amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </Layout>
  );
}
