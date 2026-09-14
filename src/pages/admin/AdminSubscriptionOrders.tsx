import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ArrowLeft, CheckCircle, XCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  fetchSubscriptionOrders,
  reviewSubscriptionOrder,
  type SubscriptionOrderStatus,
  type SubscriptionOrderWithBuyer,
} from "@/services/subscriptionOrders";

// Status words are the coin orders' own: the same three states, already in
// every locale.
const STATUS_LABEL_KEY: Record<SubscriptionOrderStatus, string> = {
  pending: "admin.vxOrders.status.pending",
  approved: "admin.vxOrders.status.approved",
  rejected: "admin.vxOrders.status.rejected",
};
const STATUS_COLOR: Record<SubscriptionOrderStatus, string> = {
  pending: "bg-yellow-500",
  approved: "bg-emerald-600",
  rejected: "bg-red-500",
};

/**
 * Plans paid through the owner on WhatsApp. Approving an order is what turns
 * the plan on, so it is pressed after the money has arrived — never before.
 */
export default function AdminSubscriptionOrders() {
  const { t, translateText } = useLanguage();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<SubscriptionOrderStatus | "all">("pending");
  const [noteDraftId, setNoteDraftId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["subscription-orders", "admin-list", filterStatus],
    queryFn: () => fetchSubscriptionOrders(filterStatus === "all" ? undefined : filterStatus),
  });

  const { mutateAsync: review, isPending: isReviewing } = useMutation({
    mutationFn: reviewSubscriptionOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscription-orders", "admin-list"] }),
  });

  const act = async (order: SubscriptionOrderWithBuyer, action: "approve" | "reject", notes: string) => {
    try {
      await review({ orderId: order.id, action, adminNotes: notes || undefined });
      toast.success(action === "approve" ? t("admin.subOrders.approvedToast") : t("admin.vxOrders.rejectedToast"));
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
            <Link to="/admin/vx" aria-label={t("admin.vxOrders.back")}><ArrowLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" /></Link>
          </Button>
          <CreditCard className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-3xl font-bold">{t("admin.subOrders.title")}</h1>
        </div>

        <div className="mb-4">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as SubscriptionOrderStatus | "all")}>
            <SelectTrigger className="w-48" aria-label={t("admin.vxOrders.col.status")}><SelectValue /></SelectTrigger>
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
                  <TableHead>{t("admin.subOrders.col.plan")}</TableHead>
                  <TableHead>{t("admin.vxOrders.col.method")}</TableHead>
                  <TableHead>{t("admin.vxOrders.col.reference")}</TableHead>
                  <TableHead>{t("admin.vxOrders.col.status")}</TableHead>
                  <TableHead>{t("admin.vxOrders.col.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t("admin.vxOrders.loading")}</TableCell></TableRow>
                )}
                {!isLoading && error && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-destructive">{(error as Error).message}</TableCell></TableRow>
                )}
                {!isLoading && !error && orders.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t("admin.subOrders.empty")}</TableCell></TableRow>
                )}
                {orders.map((order) => {
                  const status = order.status as SubscriptionOrderStatus;
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="max-w-[160px] truncate">{order.buyer_display_name || order.user_id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{translateText(order.plan_id)}</div>
                        <div className="text-xs text-muted-foreground">{t(`planCheckout.months.${order.months}`)} · ${order.price_usd}</div>
                      </TableCell>
                      <TableCell>{t(`planCheckout.method.${order.payment_method}`)}</TableCell>
                      <TableCell className="font-mono text-sm">{order.reference_code}</TableCell>
                      <TableCell><Badge className={STATUS_COLOR[status]}>{t(STATUS_LABEL_KEY[status])}</Badge></TableCell>
                      <TableCell>
                        {status === "pending" ? (
                          noteDraftId === order.id ? (
                            <div className="w-56 space-y-2">
                              <Textarea
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder={t("admin.vxOrders.rejectReasonPlaceholder")}
                                aria-label={t("admin.vxOrders.rejectReasonPlaceholder")}
                                className="min-h-16 rounded-xl text-xs"
                              />
                              <div className="flex gap-1">
                                <Button size="sm" variant="destructive" disabled={isReviewing} onClick={() => act(order, "reject", noteDraft)}>{t("admin.vxOrders.confirmReject")}</Button>
                                <Button size="sm" variant="ghost" onClick={() => setNoteDraftId(null)}>{t("admin.vxOrders.cancel")}</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              <Button size="sm" variant="outline" className="border-green-600 text-green-600" disabled={isReviewing} onClick={() => act(order, "approve", "")}>
                                <CheckCircle className="me-1 h-3 w-3" aria-hidden="true" />{t("admin.subOrders.approve")}
                              </Button>
                              <Button size="sm" variant="outline" className="border-red-600 text-red-600" disabled={isReviewing} onClick={() => { setNoteDraftId(order.id); setNoteDraft(""); }}>
                                <XCircle className="me-1 h-3 w-3" aria-hidden="true" />{t("admin.vxOrders.reject")}
                              </Button>
                            </div>
                          )
                        ) : (
                          order.admin_notes && <p className="max-w-[160px] truncate text-xs text-muted-foreground">{order.admin_notes}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
