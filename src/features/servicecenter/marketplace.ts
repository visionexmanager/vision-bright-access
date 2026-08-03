import type { LocalizedText } from "./types";

/**
 * Professional Services Marketplace — the order model.
 *
 * The five professional services used to be price cards with no follow-up.
 * This turns them into something a client can actually track: a request has a
 * status, the status has a defined order, and the client keeps a record they
 * can rate afterwards.
 *
 * `service_requests.status` is a free-text column in the existing schema, so
 * everything here is defensive about values it does not recognise.
 */

export type OrderStatus =
  | "pending"
  | "reviewing"
  | "quoted"
  | "in_progress"
  | "delivered"
  | "completed"
  | "cancelled";

/** The happy path, in order. `cancelled` sits outside it deliberately. */
export const ORDER_FLOW: OrderStatus[] = [
  "pending",
  "reviewing",
  "quoted",
  "in_progress",
  "delivered",
  "completed",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, LocalizedText> = {
  pending: { en: "Received", ar: "تم الاستلام" },
  reviewing: { en: "Under review", ar: "قيد المراجعة" },
  quoted: { en: "Quote sent", ar: "تم إرسال العرض" },
  in_progress: { en: "In progress", ar: "قيد التنفيذ" },
  delivered: { en: "Delivered", ar: "تم التسليم" },
  completed: { en: "Completed", ar: "مكتمل" },
  cancelled: { en: "Cancelled", ar: "ملغى" },
};

export const ORDER_STATUS_HINT: Record<OrderStatus, LocalizedText> = {
  pending: {
    en: "We have your request and will look at it shortly.",
    ar: "استلمنا طلبك وسنراجعه قريباً.",
  },
  reviewing: {
    en: "A specialist is reading your brief and preparing questions.",
    ar: "أحد المختصين يقرأ طلبك ويجهّز أسئلته.",
  },
  quoted: {
    en: "A price and timeline are with you — approve to start work.",
    ar: "وصلك السعر والجدول الزمني — وافق لبدء العمل.",
  },
  in_progress: {
    en: "Work has started. You will get updates as milestones land.",
    ar: "بدأ العمل. ستصلك تحديثات عند إنجاز كل مرحلة.",
  },
  delivered: {
    en: "The work is with you. Check it and confirm when you are happy.",
    ar: "تم تسليم العمل. راجعه وأكد عندما تكون راضياً.",
  },
  completed: {
    en: "Finished and confirmed. Your rating helps the next client.",
    ar: "مكتمل ومؤكد. تقييمك يساعد العميل التالي.",
  },
  cancelled: {
    en: "This request was cancelled. Nothing further is owed.",
    ar: "تم إلغاء هذا الطلب. لا توجد أي مستحقات.",
  },
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  reviewing: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
  quoted: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
  delivered: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  cancelled: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
};

/**
 * Reads a status from the database. Unknown or missing values fall back to
 * `pending` rather than breaking the client's order view.
 */
export function parseOrderStatus(value: string | null | undefined): OrderStatus {
  const normalised = (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (ORDER_STATUS_LABEL as Record<string, LocalizedText>)[normalised]
    ? (normalised as OrderStatus)
    : "pending";
}

/** 0–100 progress along the happy path. A cancelled order reports 0. */
export function orderProgress(status: OrderStatus): number {
  if (status === "cancelled") return 0;
  const index = ORDER_FLOW.indexOf(status);
  if (index < 0) return 0;
  return Math.round((index / (ORDER_FLOW.length - 1)) * 100);
}

export function isTerminal(status: OrderStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/** A client may only rate work that was actually finished. */
export function canRate(status: OrderStatus): boolean {
  return status === "completed";
}

export interface ServiceOrder {
  id: string;
  serviceType: string;
  message: string;
  status: OrderStatus;
  createdAt: string;
  rating?: number | null;
}

/** Newest first, with anything still open ahead of anything closed. */
export function sortOrders(orders: ServiceOrder[]): ServiceOrder[] {
  return [...orders].sort((a, b) => {
    const aOpen = isTerminal(a.status) ? 1 : 0;
    const bOpen = isTerminal(b.status) ? 1 : 0;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export const RATING_LABEL: Record<number, LocalizedText> = {
  1: { en: "Poor", ar: "ضعيف" },
  2: { en: "Below expectations", ar: "أقل من المتوقع" },
  3: { en: "Acceptable", ar: "مقبول" },
  4: { en: "Good", ar: "جيد" },
  5: { en: "Excellent", ar: "ممتاز" },
};
