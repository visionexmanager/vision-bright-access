import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/i18n/ar";
import en from "@/i18n/en";
import { drawnText, isGibberish, logical, type DrawnText } from "./helpers/pdfText";

// Every PDF the site makes, through the code path and the button a person
// uses — only the network and the signed-in user are stand-ins. Each document
// is read back from its bytes: Arabic must be drawn in the embedded font,
// shaped, and never in a built-in font as "þâþß…".
//
// PDF_OUT=<dir> also writes each document there, to be looked at.

const ui = vi.hoisted(() => ({ lang: "ar" as "ar" | "en", saved: [] as Array<{ name: string; pdf: string }> }));

// jsPDF creates save() on each instance, so it is caught on a subclass.
vi.mock("jspdf", async (importOriginal) => {
  const mod = await importOriginal<typeof import("jspdf")>();
  class CapturingPdf extends mod.jsPDF {
    constructor(...args: ConstructorParameters<typeof mod.jsPDF>) {
      super(...args);
      this.save = ((name?: string) => {
        ui.saved.push({ name: name ?? "", pdf: this.output() });
        return this;
      }) as unknown as typeof this.save;
    }
  }
  return { ...mod, jsPDF: CapturingPdf, default: CapturingPdf };
});

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => {
    const dict = (ui.lang === "ar" ? ar : en) as Record<string, string>;
    return { t: (key: string) => dict[key] ?? key, lang: ui.lang, dir: ui.lang === "ar" ? "rtl" : "ltr", translateText: (s: string) => s };
  },
}));
// One object for the whole run: the pages key effects on user, and a new one per render loops.
const auth = vi.hoisted(() => ({ user: { id: "user-1", email: "reader@example.com" }, loading: false }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock("@/components/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/AITaskPanel", () => ({ AITaskPanel: () => null }));
vi.mock("@/components/VoiceChat", () => ({ VoiceChat: () => null }));
vi.mock("@/components/WeeklyCalorieReport", () => ({ default: () => null }));
vi.mock("@/components/MealReminders", () => ({ default: () => null }));
vi.mock("@/lib/audio/speech", () => ({ speakText: vi.fn(), stopSpeaking: vi.fn() }));
vi.mock("@/hooks/useDocumentHead", () => ({ useDocumentHead: () => undefined }));
vi.mock("@/pages/services/ai-media-studio/StudioLayout", () => ({ StudioLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
// Radix Select cannot be driven in jsdom; a native select carries the same value.
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: { children: ReactNode; onValueChange: (v: string) => void }) => (
    <select aria-label="goal" onChange={(e) => onValueChange(e.target.value)}><option value="" />{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));

const DIET_PLAN = {
  totalCalories: 1800,
  waterIntake: "2.5 L",
  meals: [
    { name: "فطور صحي", time: "08:00", calories: 450, description: "شوفان بالحليب مع موز وملعقة من العسل، وكوب شاي أخضر بدون سكر", ingredients: ["شوفان", "حليب", "موز"] },
    { name: "غداء", time: "13:00", calories: 700, description: "صدر دجاج مشوي مع أرز بني وسلطة خضراء (خيار وطماطم)", ingredients: ["دجاج", "أرز بني"] },
  ],
  tips: ["اشرب 8 أكواب من الماء يوميا", "امشِ 30 دقيقة بعد العشاء"],
};
const DOCUMENT_RESULT = {
  title: "خطة مشروع المكتبة",
  subtitle: "عرض تقديمي لعام 2026",
  sections: [
    { heading: "الأهداف", bullets: ["زيادة عدد القراء بنسبة 40% خلال السنة الأولى", "إطلاق Visionex Library في 20 مدرسة"] },
    { heading: "الخطة (المرحلة الأولى)", bullets: ["تدريب المعلمين، ثم الطلاب؟"] },
  ],
};

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "gte", "lte", "insert", "update", "delete", "maybeSingle", "single"]) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  return {
    supabase: {
      from: () => chain,
      functions: { invoke: vi.fn(async (name: string) => (name === "generate-diet-plan" ? { data: { plan: DIET_PLAN }, error: null } : { data: null, error: null })) },
      auth: { getSession: async () => ({ data: { session: null } }) },
    },
  };
});
vi.mock("@/lib/api/edgeFunctions", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  callTextToolsGenerate: vi.fn(async () => ({ ok: true, job_id: "j", tool: "presentation", result: DOCUMENT_RESULT })),
  callImageGenerate: vi.fn(),
}));
const BOOK = {
  coverTitle: "رحلة سارة إلى القمر",
  coverAuthor: "سارة، 9 سنوات",
  coverColor: "#4F46E5",
  coverEmoji: "🚀",
  pages: [{ text: "في ليلة صافية، نظرت سارة إلى السماء وقالت: سأزور القمر يوما ما!" }, { text: "بنت سارة صاروخا من الكرتون (ولونته بالأحمر)." }],
};
vi.mock("@/features/visionkids/hooks/studio/useStudioProjects", () => ({
  useProjectById: () => ({ data: { id: "p1", content: BOOK } }),
  useCreateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/visionkids/hooks/stories/useAiStoryGenerator", () => ({ useMyAiStories: () => ({ data: [] }) }));

const FONT = "src/assets/fonts/NotoNaskhArabic-Regular.ttf";
const saved = ui.saved;

beforeAll(() => {
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).includes("NotoNaskhArabic") ? new Response(readFileSync(FONT)) : realFetch(input, init));
  // The reports download through a blob URL rather than doc.save().
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});
beforeEach(() => {
  saved.length = 0;
  ui.lang = "ar";
  (URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation((blob: Blob) => {
    // jsdom Blobs have no arrayBuffer(); FileReader reads the same bytes.
    const reader = new FileReader();
    reader.onload = () => saved.push({ name: "blob", pdf: reader.result as string });
    reader.readAsBinaryString(blob);
    return "blob:test";
  });
});

async function capture(name: string): Promise<DrawnText[]> {
  await waitFor(() => expect(saved.length).toBeGreaterThan(0), { timeout: 5000 });
  const { pdf } = saved[0];
  if (process.env.PDF_OUT) {
    mkdirSync(process.env.PDF_OUT, { recursive: true });
    writeFileSync(join(process.env.PDF_OUT, `path-${name}.pdf`), pdf, "binary");
  }
  const runs = drawnText(pdf);
  expect(runs.filter(isGibberish), `${name}: Arabic written in a built-in font`).toEqual([]);
  expect(pdf, `${name}: the Arabic font is embedded`).toContain("FontFile2");
  return runs;
}

/** All Arabic the document drew, read back in logical order, one string. */
const arabicText = (runs: DrawnText[]) => runs.filter((r) => r.embedded).map(logical).join(" ");

const certificate = {
  id: "c1", user_id: "user-1", certificate_type: "course" as const, reference_id: "r1",
  title: "دورة القراءة الذكية", recipient_name: "فاطمة الزهراء", issuer_name: "مكتبة فيجنكس",
  score_percent: 95, certificate_number: "VX-2026-0001", verification_code: "abc", signature_hash: null,
  issued_at: "2026-09-27T00:00:00Z",
};

describe("Arabic PDFs through every generator", () => {
  it("Library certificate", async () => {
    const { CertificateCard } = await import("@/components/library/learning/CertificateCard");
    render(<CertificateCard certificate={certificate} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ar["library.certificates.downloadPdf"]) }));
    const runs = await capture("library-certificate");
    expect(arabicText(runs)).toContain("فاطمة الزهراء");
    expect(arabicText(runs)).toContain("دورة القراءة الذكية");
    expect(saved[0].name).toBe("certificate-VX-2026-0001.pdf");
  });

  it("VisionKids Academy certificate", async () => {
    const { CertificateCard } = await import("@/features/visionkids/components/academy/CertificateCard");
    render(<CertificateCard certificate={certificate} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ar["kids.academy.exportPdf"]) }));
    const runs = await capture("kids-academy-certificate");
    expect(arabicText(runs)).toContain("فاطمة الزهراء");
    expect(saved[0].name).toBe("vision-kids-certificate-VX-2026-0001.pdf");
  });

  it("VisionKids event certificate", async () => {
    const { EventCertificateCard } = await import("@/features/visionkids/components/events/EventCertificateCard");
    render(<EventCertificateCard certificate={{ ...certificate, title: "مسابقة القراءة الصيفية" }} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ar["kids.academy.exportPdf"]) }));
    const runs = await capture("kids-event-certificate");
    expect(arabicText(runs)).toContain("مسابقة القراءة الصيفية");
    expect(saved[0].name).toBe("vision-kids-event-certificate-VX-2026-0001.pdf");
  });

  it("VisionKids explorer certificate", async () => {
    const { ExplorerCertificateCard } = await import("@/features/visionkids/components/explorer/ExplorerCertificateCard");
    render(<ExplorerCertificateCard certificate={{ ...certificate, title: "عوالم المستكشف" }} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ar["kids.academy.exportPdf"]) }));
    const runs = await capture("kids-explorer-certificate");
    expect(arabicText(runs)).toContain("عوالم المستكشف");
    expect(saved[0].name).toBe("vision-kids-explorer-certificate-VX-2026-0001.pdf");
  });

  it("VisionKids BookCreator", async () => {
    const { default: BookCreator } = await import("@/features/visionkids/pages/studio/BookCreator");
    render(<MemoryRouter initialEntries={["/b/p1"]}><Routes><Route path="/b/:projectId" element={<BookCreator />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ar["kids.studio.exportPdf"]) }));
    const runs = await capture("book-creator");
    const text = arabicText(runs);
    expect(text).toContain("رحلة سارة إلى القمر");
    expect(text).toContain(ar["kids.studio.tableOfContents"].split(" ")[0]);
    expect(text).toContain("في ليلة صافية");
    // The cover emoji is a picture now, never Helvetica's "Ø=Þ€".
    expect(runs.some((r) => !r.embedded && /Ø=Þ/.test(r.text))).toBe(false);
    expect(saved[0].name).toBe("رحلة سارة إلى القمر.pdf");
  });

  it("Organization report", async () => {
    const { downloadOrganizationReport } = await import("@/lib/library/organizationReports");
    await downloadOrganizationReport({
      organizationName: "مدرسة النور", reportTitle: "تقرير القراءة الشهري", generatedAt: "2026-09-27",
      tables: [{ title: "الطلاب الأكثر قراءة", columns: ["الاسم", "الكتب"], rows: [["أحمد", 12], ["Sara", 9]] }],
    }, "pdf");
    const runs = await capture("organization-report");
    const text = arabicText(runs);
    for (const s of ["تقرير القراءة الشهري", "مدرسة النور", "الطلاب الأكثر قراءة", "أحمد"]) expect(text).toContain(s);
    expect(runs.some((r) => !r.embedded && r.text === "Sara")).toBe(true);
  });

  it("Research export", async () => {
    const { downloadResearchExport } = await import("@/lib/library/researchExport");
    await downloadResearchExport({
      projectTitle: "بحث عن التعلم الرقمي",
      projectDescription: "يدرس هذا البحث أثر المكتبات الرقمية على عادات القراءة لدى الطلاب في المرحلة الثانوية خلال عام 2026.",
      items: [{ itemType: "note", title: "ملاحظة (1)", content: "زاد متوسط القراءة الأسبوعية بنسبة 25% بعد استخدام التطبيق.", citation: "فيجنكس، تقرير 2026", addedAt: "2026-09-27" }],
    }, "pdf");
    const runs = await capture("research-export");
    const text = arabicText(runs);
    for (const s of ["بحث عن التعلم الرقمي", "ملاحظة", "زاد متوسط القراءة"]) expect(text).toContain(s);
  });

  it("Business feasibility report", async () => {
    const { default: BusinessEconomy } = await import("@/pages/BusinessEconomy");
    render(<MemoryRouter><BusinessEconomy /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(ar["econ.projectNamePh"]), { target: { value: "مقهى الكتب" } });
    fireEvent.change(screen.getByPlaceholderText(ar["econ.sectorPh"]), { target: { value: "مطاعم" } });
    const money = screen.getAllByPlaceholderText("$");
    fireEvent.change(money[0], { target: { value: "20000" } });
    fireEvent.change(money[1], { target: { value: "3000" } });
    fireEvent.change(money[2], { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ar["econ.analyze"]) }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(ar["econ.exportPdf"]) }));
    const runs = await capture("business-economy");
    const text = arabicText(runs);
    for (const s of ["مقهى الكتب", "مطاعم", ar["econ.feasibilityReport"]]) expect(text).toContain(s);
    expect(saved[0].name).toBe("feasibility-مقهى الكتب.pdf");
  });

  it("Nutrition diet plan", async () => {
    const { default: NutritionExpert } = await import("@/pages/NutritionExpert");
    render(<MemoryRouter><NutritionExpert /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(ar["nutrition.namePlaceholder"]), { target: { value: "سارة" } });
    fireEvent.change(screen.getByLabelText("goal"), { target: { value: "healthy-lifestyle" } });
    fireEvent.change(screen.getByPlaceholderText("70"), { target: { value: "60" } });
    fireEvent.change(screen.getByPlaceholderText("175"), { target: { value: "165" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ar["nutrition.enterClinic"]) }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(ar["nutrition.generatePlan"]) }));
    fireEvent.click(await screen.findByRole("button", { name: /^PDF$/ }));
    const runs = await capture("nutrition");
    const text = arabicText(runs);
    for (const s of ["سارة", "فطور صحي", "شوفان بالحليب", "اشرب", "صدر دجاج مشوي"]) expect(text).toContain(s);
    expect(saved[0].name).toBe("diet-plan-سارة.pdf");
  });

  it("Text Tools presentation", async () => {
    const { default: TextToolsStudio } = await import("@/pages/services/ai-media-studio/TextToolsStudio");
    render(<MemoryRouter><TextToolsStudio /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Presentation Generator/ }));
    fireEvent.change(screen.getByLabelText("Presentation Generator"), { target: { value: "خطة مشروع" } });
    fireEvent.click(screen.getByRole("button", { name: /Generate/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Download PDF/ }));
    const runs = await capture("text-tools");
    const text = arabicText(runs);
    for (const s of ["خطة مشروع المكتبة", "الأهداف", "زيادة عدد القراء بنسبة", "تدريب المعلمين"]) expect(text).toContain(s);
    expect(runs.some((r) => !r.embedded && r.text.includes("Visionex Library"))).toBe(true);
  });

  it("an English certificate is drawn exactly as before, without the Arabic font", async () => {
    ui.lang = "en";
    const { CertificateCard } = await import("@/components/library/learning/CertificateCard");
    render(<CertificateCard certificate={{ ...certificate, title: "Smart Reading", recipient_name: "Fatima Zahra", issuer_name: "Visionex Library" }} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en["library.certificates.downloadPdf"]) }));
    await waitFor(() => expect(saved.length).toBe(1));
    expect(saved[0].pdf).not.toContain("FontFile2");
    const runs = drawnText(saved[0].pdf);
    expect(runs.every((r) => !r.embedded)).toBe(true);
    expect(runs.map((r) => r.text)).toContain("Fatima Zahra");
  });
});
