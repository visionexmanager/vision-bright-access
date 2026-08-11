// Contact Us routing and auto-reply copy.
//
// One department id decides three things: which public inbox the internal
// notification goes to, which verified sender the auto-reply comes from, and
// which acknowledgement the sender reads. Keeping them in one table stops a
// support message from being answered with billing wording.
//
// The ids mirror src/features/contact/departments.ts. Adding a department
// means adding it in both places.
//
// Internal mailboxes are not listed here. They come from the
// CONTACT_INTERNAL_RECIPIENTS secret at runtime, so no staff address is ever
// committed to the repository.

export type ContactDepartmentId = "general" | "support" | "billing" | "news";

export const DEFAULT_DEPARTMENT: ContactDepartmentId = "general";

export interface DepartmentRoute {
  /** Public inbox that receives the internal notification. */
  inbox: string;
  /** Key of a verified sender in the send-email ALLOWED_SENDERS table. */
  sender: string;
  /** Shown to the sender in the acknowledgement subject line. */
  label: { en: string; ar: string };
  /**
   * Department-specific sentence inserted after the shared opening. Keeps the
   * professional register identical across departments and only changes what
   * the sender is told to expect.
   */
  note: { en: string; ar: string };
}

export const DEPARTMENT_ROUTES: Record<ContactDepartmentId, DepartmentRoute> = {
  general: {
    inbox: "hello@visionex.app",
    sender: "hello",
    label: { en: "General Inquiries", ar: "الاستفسارات العامة" },
    note: {
      en: "If your request requires further information, we will contact you by email.",
      ar: "إذا كان طلبك يحتاج إلى معلومات إضافية، سنتواصل معك عبر البريد الإلكتروني.",
    },
  },
  support: {
    inbox: "support@visionex.app",
    sender: "support",
    label: { en: "Technical Support", ar: "الدعم الفني" },
    note: {
      en: "Our technical support team will review the details you sent. If we need more information — such as the page you were on, your browser, or the assistive technology you use — we will ask for it by email.",
      ar: "سيقوم فريق الدعم الفني بمراجعة التفاصيل التي أرسلتها. وإذا احتجنا إلى معلومات إضافية — مثل الصفحة التي كنت فيها، أو المتصفح، أو التقنية المساعدة التي تستخدمها — فسنطلبها منك عبر البريد الإلكتروني.",
    },
  },
  billing: {
    inbox: "billing@visionex.app",
    sender: "billing",
    label: { en: "Billing & Payments", ar: "الفوترة والدفع" },
    note: {
      en: "Our billing team will review your account and payment details. For your security, never send full card numbers or passwords by email — we will never ask for them.",
      ar: "سيراجع فريق الفوترة تفاصيل حسابك ومدفوعاتك. ولأمانك، لا ترسل أرقام البطاقات كاملة أو كلمات المرور عبر البريد الإلكتروني — نحن لن نطلبها منك أبداً.",
    },
  },
  news: {
    inbox: "news@visionex.app",
    sender: "news",
    label: { en: "News & Media", ar: "الأخبار والإعلام" },
    note: {
      en: "Our media team will review your request. For press enquiries with a deadline, please mention it in your message so we can prioritise accordingly.",
      ar: "سيراجع الفريق الإعلامي طلبك. وإذا كان الاستفسار الصحفي مرتبطاً بموعد نهائي، فيرجى ذكره في رسالتك لنمنحه الأولوية المناسبة.",
    },
  },
};

export function resolveDepartment(value: unknown): ContactDepartmentId {
  return typeof value === "string" && value in DEPARTMENT_ROUTES
    ? (value as ContactDepartmentId)
    : DEFAULT_DEPARTMENT;
}

/** Arabic for the `ar` locale, English for everything else. */
export function replyLanguage(locale: unknown): "en" | "ar" {
  return typeof locale === "string" && locale.toLowerCase().startsWith("ar") ? "ar" : "en";
}

/** Escape untrusted text before it goes into an HTML email body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface AutoReply {
  subject: string;
  html: string;
  text: string;
}

/**
 * Acknowledgement sent to whoever submitted the form. The opening and closing
 * are the same in every department; only `note` changes.
 */
export function buildAutoReply(
  department: ContactDepartmentId,
  language: "en" | "ar",
  fullName: string,
): AutoReply {
  const route = DEPARTMENT_ROUTES[department];
  const name = escapeHtml(fullName.trim());
  const rtl = language === "ar";

  const body =
    language === "ar"
      ? {
          subject: `شكراً لتواصلك مع Visionex — ${route.label.ar}`,
          greeting: name ? `مرحباً ${name}،` : "مرحباً،",
          opening:
            "شكراً لتواصلك مع Visionex. لقد استلمنا رسالتك وسيقوم فريقنا بمراجعتها في أقرب وقت ممكن.",
          note: route.note.ar,
          closing: "مع أطيب التحيات،",
          team: "فريق Visionex",
        }
      : {
          subject: `Thank you for contacting Visionex — ${route.label.en}`,
          greeting: name ? `Hello ${name},` : "Hello,",
          opening:
            "Thank you for contacting Visionex. We have received your message and our team will review it as soon as possible.",
          note: route.note.en,
          closing: "Best regards,",
          team: "Visionex Team",
        };

  const text = [
    body.greeting,
    "",
    body.opening,
    "",
    body.note,
    "",
    body.closing,
    body.team,
    "https://visionex.app",
  ].join("\n");

  // Plain semantic HTML: no images, no tracking pixels, no layout tables, and
  // lang/dir set so a screen reader announces the message in the right voice.
  const html = `<!doctype html>
<html lang="${language}" dir="${rtl ? "rtl" : "ltr"}">
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;line-height:1.7">
    <main style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
      <p style="margin:0 0 16px">${escapeHtml(body.greeting)}</p>
      <p style="margin:0 0 16px">${escapeHtml(body.opening)}</p>
      <p style="margin:0 0 16px">${escapeHtml(body.note)}</p>
      <p style="margin:24px 0 0">${escapeHtml(body.closing)}<br>${escapeHtml(body.team)}</p>
      <p style="margin:8px 0 0"><a href="https://visionex.app" style="color:#6d28d9">https://visionex.app</a></p>
    </main>
  </body>
</html>`;

  return { subject: body.subject, html, text };
}

/**
 * Internal notification. Goes to the department inbox, plus anyone listed in
 * CONTACT_INTERNAL_RECIPIENTS. Reply-To is the sender so a human can answer
 * straight from their mail client.
 */
export function buildInternalNotification(params: {
  department: ContactDepartmentId;
  fullName: string;
  email: string;
  phone?: string | null;
  serviceType: string;
  message: string;
  attachmentUrl?: string | null;
}): { subject: string; html: string } {
  const route = DEPARTMENT_ROUTES[params.department];
  const row = (label: string, value: string) =>
    `<p style="margin:0 0 8px"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;

  const attachment = params.attachmentUrl
    ? `<p style="margin:0 0 8px"><strong>Attachment:</strong> <a href="${escapeHtml(params.attachmentUrl)}">${escapeHtml(params.attachmentUrl)}</a></p>`
    : "";

  return {
    subject: `[${route.label.en}] ${params.fullName.trim() || "New contact request"}`,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;line-height:1.6">
    <h1 style="font-size:18px;margin:0 0 16px">New ${escapeHtml(route.label.en)} request</h1>
    ${row("Name", params.fullName)}
    ${row("Email", params.email)}
    ${params.phone ? row("Phone", params.phone) : ""}
    ${row("Service type", params.serviceType)}
    ${attachment}
    <p style="margin:16px 0 4px"><strong>Message</strong></p>
    <pre style="white-space:pre-wrap;font-family:inherit;margin:0;padding:12px;background:#f1f5f9;border-radius:8px">${escapeHtml(params.message)}</pre>
  </body>
</html>`,
  };
}
