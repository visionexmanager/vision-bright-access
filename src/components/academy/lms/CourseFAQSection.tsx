import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface FAQItem {
  question: string;
  answer: string;
}

interface CourseFAQSectionProps {
  isFreeCourse: boolean;
}

/**
 * General platform FAQ (not per-course content, since course-specific FAQ
 * authoring isn't modeled yet). Answers are honest about what's implemented.
 */
export function CourseFAQSection({ isFreeCourse }: CourseFAQSectionProps) {
  const items: FAQItem[] = [
    {
      question: "هل أحصل على شهادة بعد إتمام الدورة؟",
      answer: "إصدار الشهادات قيد التطوير حالياً وسيتوفر في مرحلة قادمة من الأكاديمية.",
    },
    {
      question: "هل يمكنني متابعة الدورة من نفس النقطة على أي جهاز؟",
      answer: "حالياً يتم حفظ تقدّمك محلياً على متصفحك. المزامنة عبر الأجهزة قادمة مع تفعيل الحساب السحابي الكامل.",
    },
    {
      question: isFreeCourse ? "هل هذه الدورة مجانية فعلاً؟" : "كيف يتم الدفع مقابل هذه الدورة؟",
      answer: isFreeCourse
        ? "نعم، هذه الدورة متاحة مجاناً لجميع طلاب الأكاديمية."
        : "الدفع عبر رصيد VX قيد التطوير — ستتمكن قريباً من الاشتراك مباشرة من صفحة الدورة.",
    },
  ];

  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((item, i) => (
        <AccordionItem key={i} value={`faq-${i}`}>
          <AccordionTrigger className="text-start">{item.question}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
