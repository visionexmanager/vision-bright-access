import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, CheckCircle, XCircle, Coins, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useVxCoinOrdersAdmin } from "@/hooks/useVxCoinOrders";
import type { VxCoinOrderStatus, VxCoinOrderWithBuyer } from "@/services/vxCoins";
import { useLanguage } from "@/contexts/LanguageContext";

const STATUS_LABEL_KEY: Record<VxCoinOrderStatus, string> = {
  pending: "admin.vxOrders.status.pending",
  approved: "admin.vxOrders.status.approved",
  rejected: "admin.vxOrders.status.rejected",
};
const STATUS_COLOR: Record<VxCoinOrderStatus, string> = {
  pending: "bg-yellow-500",
  approved: "bg-emerald-600",
  rejected: "bg-red-500",
};
const METHOD_LABEL_KEY: Record<string, string> = {
  wishmoney: "coins.method.wishmoney",
  omt: "coins.method.omt",
  paypal: "coins.method.paypal",
};

export default function AdminVXCoinOrders() {
  const { t } = useLanguage();
  const [filterStatus, setFilterStatus] = useState<VxCoinOrderStatus | "all">("pending");
  const { orders, isLoading, error, review, isReviewing } = useVxCoinOrdersAdmin(filterStatus);
  const [noteDraftId, setNoteDraftId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const act = async (order: VxCoinOrderWithBuyer, action: "approve" | "reject", notes: string) => {
    try {
      await review({ orderId: order.id, action, adminNotes: notes || undefined });
      toast.success(action === "approve" ? t("admin.vxOrders.approvedToast") : t("admin.vxOrders.rejectedToast"));
      setNoteDraftId(null);
      setNoteDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.vxOrders.actionError"));
    }
  };

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/admin" aria-label={t("admin.vxOrders.back")}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link>
          </Button>
          <Coins className="h-6 w-6 text-yellow-500" aria-hidden="true" />
          <h1 className="text-3xl font-bold">{t("admin.vxOrders.title")}</h1>
        </div>

        <div className="mb-4">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as VxCoinOrderStatus | "all")}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.vxOrders.filterAll")}</SelectItem>
              <SelectItem value="pending">{t(STATUS_LABEL_KEY.pending)}</SelectItem>
              <SelectItem value="approved">{t(STATUS_LABEL_KEY.approved)}</SelectItem>
              <SelectItem value="rejected">{t(STATUS_LABEL_KEY.rejected)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.vxOrders.col.buyer")}</TableHead>
                  <TableHead>{t("admin.vxOrders.col.package")}</TableHead>
                  <TableHead>{t("admin.vxOrders.col.method")}</TableHead>
                  <TableHead>{t("admin.vxOrders.col.reference")}</TableHead>
                  <TableHead>{t("admin.vxOrders.col.proof")}</TableHead>
                  <TableHead>{t("admin.vxOrders.col.status")}</TableHead>
                  <TableHead>{t("admin.vxOrders.col.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("admin.vxOrders.loading")}</TableCell></TableRow>
                )}
                {!isLoading && error && (
                  <TableRow><TableCell colSpan={7} className="text-center text-destructive py-8">{error}</TableCell></TableRow>
                )}
                {!isLoading && !error && orders.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("admin.vxOrders.empty")}</TableCell></TableRow>
                )}
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="max-w-[160px] truncate">{order.buyer_display_name || order.user_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{order.coins.toLocaleString()} VX</div>
                      <div className="text-xs text-muted-foreground">${order.total_usd}</div>
                    </TableCell>
                    <TableCell>{t(METHOD_LABEL_KEY[order.payment_method] ?? order.payment_method)}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-sm">{order.reference_code}</TableCell>
                    <TableCell>
                      {order.proof_url ? (
                        <a href={order.proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> {t("admin.vxOrders.viewProof")}
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell><Badge className={STATUS_COLOR[order.status]}>{t(STATUS_LABEL_KEY[order.status])}</Badge></TableCell>
                    <TableCell>
                      {order.status === "pending" ? (
                        noteDraftId === order.id ? (
                          <div className="w-56 space-y-2">
                            <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={t("admin.vxOrders.rejectReasonPlaceholder")} className="min-h-16 rounded-xl text-xs" />
                            <div className="flex gap-1">
                              <Button size="sm" variant="destructive" disabled={isReviewing} onClick={() => act(order, "reject", noteDraft)}>{t("admin.vxOrders.confirmReject")}</Button>
                              <Button size="sm" variant="ghost" onClick={() => setNoteDraftId(null)}>{t("admin.vxOrders.cancel")}</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant="outline" className="text-green-600 border-green-600" disabled={isReviewing} onClick={() => act(order, "approve", "")}>
                              <CheckCircle className="me-1 h-3 w-3" aria-hidden="true" />{t("admin.vxOrders.approve")}
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-600" disabled={isReviewing} onClick={() => { setNoteDraftId(order.id); setNoteDraft(""); }}>
                              <XCircle className="me-1 h-3 w-3" aria-hidden="true" />{t("admin.vxOrders.reject")}
                            </Button>
                          </div>
                        )
                      ) : (
                        order.admin_notes && <p className="max-w-[160px] truncate text-xs text-muted-foreground">{order.admin_notes}</p>
                      )}
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
