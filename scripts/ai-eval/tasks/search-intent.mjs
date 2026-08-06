// Golden set for the library search-intent classifier.
//
// System prompt, schema and tool name are copied verbatim from
// supabase/functions/library-ai-search/index.ts so the eval measures the
// provider, not a reworded prompt.
//
// Cases are split evenly between Arabic and English. Ambiguous queries are
// excluded on purpose: "ما هو الذكاء الاصطناعي؟" is defensibly either a
// question or an entity lookup, and grading a provider against a coin flip
// tells you nothing. Every case below has one answer a careful person would
// give.

export const schema = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["book_search", "question", "entity_lookup"] },
    synonyms: { type: "array", maxItems: 5, items: { type: "string" } },
  },
  required: ["intent", "synonyms"],
  additionalProperties: false,
};

export const task = {
  key: "search-intent",
  description: "Library search intent classification (library-ai-search)",
  system:
    "Classify the search intent of a library search query: 'book_search' (looking for a book/topic), 'question' (a natural-language question expecting an answer), or 'entity_lookup' (looking up a specific person/place/concept/technology). Also suggest up to 5 synonyms or closely related search terms.",
  toolName: "classify_search_intent",
  schema,
  maxTokens: 200,
  // Only `intent` is graded. `synonyms` is free text with no single correct
  // answer; it is still schema-checked, so a provider that returns six
  // synonyms or a non-array fails the shape check.
  gradedFields: ["intent"],
  cases: [
    { id: "en-book-1", input: "books about the French Revolution", expected: { intent: "book_search" } },
    { id: "ar-book-1", input: "كتب عن الفيزياء الكمية", expected: { intent: "book_search" } },
    { id: "en-book-2", input: "beginner Python programming books", expected: { intent: "book_search" } },
    { id: "ar-book-2", input: "روايات خيال علمي للمبتدئين", expected: { intent: "book_search" } },
    { id: "en-book-3", input: "recommend history books for teenagers", expected: { intent: "book_search" } },
    { id: "ar-book-3", input: "أفضل الكتب في تعلّم اللغة الإنجليزية", expected: { intent: "book_search" } },

    { id: "en-q-1", input: "How do I improve my reading speed?", expected: { intent: "question" } },
    { id: "ar-q-1", input: "كيف أحسّن سرعة القراءة؟", expected: { intent: "question" } },
    { id: "en-q-2", input: "Who wrote The Muqaddimah?", expected: { intent: "question" } },
    { id: "ar-q-2", input: "من كتب المقدمة؟", expected: { intent: "question" } },
    { id: "en-q-3", input: "Why do leaves change colour in autumn?", expected: { intent: "question" } },
    { id: "ar-q-3", input: "لماذا تتغيّر ألوان أوراق الشجر في الخريف؟", expected: { intent: "question" } },

    { id: "en-ent-1", input: "Ibn Khaldun", expected: { intent: "entity_lookup" } },
    { id: "ar-ent-1", input: "ابن خلدون", expected: { intent: "entity_lookup" } },
    { id: "en-ent-2", input: "quantum entanglement", expected: { intent: "entity_lookup" } },
    { id: "ar-ent-2", input: "التعلّم العميق", expected: { intent: "entity_lookup" } },
    { id: "en-ent-3", input: "Marie Curie", expected: { intent: "entity_lookup" } },
    { id: "ar-ent-3", input: "مدينة دمشق", expected: { intent: "entity_lookup" } },
  ],
};

export default task;
