// Golden set for the library book classifier.
//
// System prompt, schema and tool name are copied verbatim from
// supabase/functions/library-ai-classify-book/index.ts.
//
// Only the two enum fields are graded, and only where the description makes
// the answer unarguable — a case that states "ages 4–6, large type" has one
// reading level. `difficulty_level` is omitted from the expectations of the
// fiction cases: how "difficult" a young adult novel is has no settled answer,
// and inventing one would grade providers against this file's opinion rather
// than against being right. topics/subtopics/keywords are never graded, only
// schema-checked.

export const schema = {
  type: "object",
  properties: {
    topics: { type: "array", maxItems: 6, items: { type: "string" } },
    subtopics: { type: "array", maxItems: 10, items: { type: "string" } },
    keywords: { type: "array", maxItems: 15, items: { type: "string" } },
    difficulty_level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    reading_level: { type: "string", enum: ["early_reader", "middle_grade", "young_adult", "adult", "graduate"] },
  },
  required: ["topics", "subtopics", "keywords", "difficulty_level", "reading_level"],
  additionalProperties: false,
};

export const task = {
  key: "book-classify",
  description: "Library book classification (library-ai-classify-book)",
  system:
    "You classify a book's subject matter for a digital library catalog. Generate broad topics (high-level subjects), narrower subtopics, searchable keywords, a skill difficulty level, and an age/grade reading level. Base this only on the given text — never invent plot details or facts not implied by it.",
  toolName: "classify_book",
  schema,
  maxTokens: 800,
  gradedFields: ["difficulty_level", "reading_level"],
  cases: [
    {
      id: "en-picture",
      input: "A picture book about a curious duckling who learns to swim. Large type, 24 pages, written for ages 4 to 6.",
      expected: { difficulty_level: "beginner", reading_level: "early_reader" },
    },
    {
      id: "ar-picture",
      input: "كتاب مصوّر للأطفال من عمر 4 إلى 6 سنوات عن بطّة صغيرة فضولية تتعلّم السباحة، بخطّ كبير و24 صفحة.",
      expected: { difficulty_level: "beginner", reading_level: "early_reader" },
    },
    {
      id: "en-graduate",
      input: "A graduate-level monograph on measure-theoretic probability, assuming prior familiarity with real analysis and functional analysis.",
      expected: { difficulty_level: "advanced", reading_level: "graduate" },
    },
    {
      id: "ar-graduate",
      input: "دراسة متقدّمة على مستوى الدراسات العليا في نظرية القياس والاحتمالات، تفترض إلماماً مسبقاً بالتحليل الحقيقي والتحليل الدالّي.",
      expected: { difficulty_level: "advanced", reading_level: "graduate" },
    },
    {
      id: "en-intro-tech",
      input: "An introductory textbook on Python for absolute beginners with no prior programming experience, aimed at working adults changing careers.",
      expected: { difficulty_level: "beginner", reading_level: "adult" },
    },
    {
      id: "ar-intro-tech",
      input: "كتاب تمهيدي في لغة بايثون للمبتدئين تماماً بلا أي خبرة برمجية سابقة، موجّه للبالغين الراغبين بتغيير مسارهم المهني.",
      expected: { difficulty_level: "beginner", reading_level: "adult" },
    },
    {
      id: "en-intermediate-tech",
      input: "An intermediate guide to distributed systems for practising engineers who already understand networking fundamentals and databases.",
      expected: { difficulty_level: "intermediate", reading_level: "adult" },
    },
    {
      id: "ar-intermediate-tech",
      input: "دليل متوسّط المستوى في الأنظمة الموزّعة لمهندسين يعملون في المجال ويعرفون أساسيات الشبكات وقواعد البيانات.",
      expected: { difficulty_level: "intermediate", reading_level: "adult" },
    },
    {
      id: "en-ya",
      input: "A fantasy novel about a sixteen-year-old apprentice mage, published for readers aged 13 to 17.",
      expected: { reading_level: "young_adult" },
    },
    {
      id: "ar-ya",
      input: "رواية فانتازيا عن ساحر متدرّب في السادسة عشرة من عمره، صادرة للقرّاء بين 13 و17 سنة.",
      expected: { reading_level: "young_adult" },
    },
    {
      id: "en-middle-grade",
      input: "An adventure story about a group of friends solving a mystery in their village, written for ages 9 to 12.",
      expected: { reading_level: "middle_grade" },
    },
    {
      id: "ar-middle-grade",
      input: "قصة مغامرات عن مجموعة أصدقاء يحلّون لغزاً في قريتهم، مكتوبة للأعمار من 9 إلى 12 سنة.",
      expected: { reading_level: "middle_grade" },
    },
  ],
};

export default task;
