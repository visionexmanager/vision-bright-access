import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  CONTENT_SECTIONS,
  CONTENT_TYPES,
  CONTENT_PLATFORMS,
  CONTENT_PROPOSAL_SCHEMA,
  buildContentWriterSystem,
} from "../../supabase/functions/_shared/content/writerPrompt.ts";
import {
  CONTENT_APPROVAL_TYPE,
  SECTION_SEEDS,
  buildMemoryContext,
  contentApprovalExpiry,
  decideUnlessContentApproval,
  detectConfidentialLeak,
  generateAfterInputScreen,
  normalizeProposedTime,
  normalizeTopicKey,
  renderSourcesForPrompt,
  validateSourceRefs,
} from "../../supabase/functions/_shared/content/proposalRules.ts";
import { INTERNAL_ONLY_FIELDS } from "../../supabase/functions/_shared/sourcing/confidentiality.ts";

// Phase 7. The engine drafts and stops; a human decides. These cover the two
// things that would matter most if they broke — that nothing can publish, and
// that no internal sourcing detail can ride out on a customer-facing draft —
// plus the duplicate rules the owner asked for by name.

// generators.ts type-imports aiProvider.ts, which is Deno-only, so it is read
// as text rather than imported — importing it would drag `Deno` into the app's
// TypeScript program. The parts worth exercising for real (the schema and the
// prompt builder) live in the import-free content/writerPrompt.ts above.
const generators = readFileSync("supabase/functions/_shared/generators.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260904000000_ai_content_engine.sql", "utf8");
const engine = readFileSync("supabase/functions/_shared/contentEngine.ts", "utf8");
const ownerControl = readFileSync("supabase/functions/owner-control/index.ts", "utf8");
const aiGenerate = readFileSync("supabase/functions/ai-generate/index.ts", "utf8");
const embedContent = readFileSync("supabase/functions/embed-content/index.ts", "utf8");
const dashboard = readFileSync("src/pages/admin/OwnerControlCenter.tsx", "utf8");

/** The nine generators that existed before per-generator schemas were possible. */
const LEGACY_GENERATORS = [
  "training-plan", "content-summary", "travel-itinerary", "career-roadmap",
  "web-project-brief", "marketing-campaign", "tech-troubleshooting-plan",
  "training-curriculum", "import-sourcing-checklist",
];

/** Generator ids as the registry actually declares them. */
const registeredIds = [...generators.matchAll(/^ {2}"([a-z-]+)": \{$/gm)].map((m) => m[1]);

describe("generator registry stays backward compatible", () => {
  it("leaves every pre-existing generator on the universal plan schema", () => {
    // The whole point of making `schema` optional. A legacy generator that
    // acquired one would silently change the shape ai-generate returns to the
    // frontend renderer. Exactly one entry may declare a schema.
    expect(generators.match(/^ {4}schema:/gm)).toHaveLength(1);
    expect(generators.match(/^ {4}toolName:/gm)).toHaveLength(1);

    const writerAt = generators.indexOf('"content-writer": {');
    expect(generators.indexOf("    schema:")).toBeGreaterThan(writerAt);
    expect(generators.indexOf("    toolName:")).toBeGreaterThan(writerAt);
  });

  it("still ships exactly the nine legacy generators plus content-writer", () => {
    expect([...registeredIds].sort()).toEqual([...LEGACY_GENERATORS, "content-writer"].sort());
  });

  it("falls back to the universal schema and tool name in ai-generate", () => {
    expect(aiGenerate).toContain("generator.schema ?? (GENERATION_SCHEMA");
    expect(aiGenerate).toContain('generator.toolName ?? "generated_plan"');
  });

  it("keeps the universal schema itself unchanged", () => {
    expect(generators).toContain('required: ["title", "summary", "sections", "tips"]');
  });
});

describe("content-writer", () => {
  it("is registered with its own schema and tool name", () => {
    expect(registeredIds).toContain("content-writer");
    expect(generators).toContain("schema: CONTENT_PROPOSAL_SCHEMA");
    expect(generators).toContain('toolName: "content_proposal"');
    expect(generators).toContain("buildSystem: buildContentWriterSystem");
  });

  it("carries every field the owner needs to decide", () => {
    // Nothing here may be recoverable-from-prose only: each is a typed
    // property, which is why the universal plan schema could not be reused.
    for (const field of [
      "content_type", "section", "platform", "topic", "hook", "body",
      "hashtags", "rationale", "target_audience", "proposed_publish_at", "source_refs",
    ]) {
      expect(CONTENT_PROPOSAL_SCHEMA.properties, field).toHaveProperty(field);
      expect(CONTENT_PROPOSAL_SCHEMA.required).toContain(field);
    }
    expect(CONTENT_PROPOSAL_SCHEMA.additionalProperties).toBe(false);
  });

  it("constrains the enums to the project's real vocabularies", () => {
    expect(CONTENT_PROPOSAL_SCHEMA.properties.section.enum).toEqual(CONTENT_SECTIONS);
    expect(CONTENT_PROPOSAL_SCHEMA.properties.content_type.enum).toEqual(CONTENT_TYPES);
    expect(CONTENT_PROPOSAL_SCHEMA.properties.platform.enum).toEqual(CONTENT_PLATFORMS);
  });

  it("instructs the model to stay inside the retrieved records", () => {
    const system = buildContentWriterSystem(
      { section: "products", contentType: "post", platform: "website", sources: "- [abc] (products) Braille display" },
      "en",
    );
    expect(system).toContain("Do not invent");
    expect(system).toContain("Braille display");
    expect(system).toMatch(/never name a supplier/i);
  });

  it("is generated for real, never simulated", () => {
    // useAiSimulation is a client-side setTimeout around a local function. If
    // the proposals path ever reached it the UI would look like it worked while
    // producing text that never touched a model.
    expect(engine).toContain("structuredCompletion");
    expect(engine).not.toContain("useAiSimulation");
    expect(dashboard).not.toContain("useAiSimulation");
  });
});

describe("discovery uses only what is actually indexed", () => {
  it("offers exactly the source tables embed-content indexes", () => {
    const block = embedContent.slice(
      embedContent.indexOf("const SOURCES"),
      embedContent.indexOf("\n};", embedContent.indexOf("const SOURCES")),
    );
    const indexed = [...block.matchAll(/^ {2}([a-z_]+): \{/gm)].map((m) => m[1]);
    const virtual = embedContent.match(/SERVICES_SOURCE = "(\w+)"/)![1];

    expect([...CONTENT_SECTIONS].sort()).toEqual([...indexed, virtual].sort());
  });

  it("names no section the project does not index", () => {
    // Library, news, arcade games and "features" were asked for and are not in
    // ai_embeddings. Offering them would only invite an ungrounded draft.
    for (const absent of ["library_books", "news", "news_articles", "arcade_games", "features"]) {
      expect(CONTENT_SECTIONS as readonly string[]).not.toContain(absent);
    }
  });

  it("has a discovery seed for every section and no orphan seeds", () => {
    expect(Object.keys(SECTION_SEEDS).sort()).toEqual([...CONTENT_SECTIONS].sort());
  });

  it("retrieves through the existing index rather than a second one", () => {
    expect(engine).toContain('rpc("match_embeddings"');
    expect(engine).toContain("filter_source: opts.section");
    // No second embeddings store, and no separate retrieval table.
    expect(engine).not.toMatch(/content_embeddings|ai_embeddings_v2|from\("ai_embeddings"\)/);
  });

  it("refuses a section with nothing indexed instead of inventing one", () => {
    expect(engine).toContain('error: "no_indexed_content"');
  });
});

describe("confidentiality", () => {
  it("screens every field the Phase 6 allow-list marks internal", () => {
    for (const field of INTERNAL_ONLY_FIELDS) {
      expect(detectConfidentialLeak(`The ${field} is 12.`), field).toContain(field);
    }
  });

  it("catches the four the owner named, in both casings", () => {
    for (const term of ["sourceSlug", "sourcePriceUsd", "shippingUsd", "pricingBreakdown"]) {
      expect(detectConfidentialLeak(`value: ${term}`).length).toBeGreaterThan(0);
      const snake = term.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      expect(detectConfidentialLeak(`value: ${snake}`).length).toBeGreaterThan(0);
    }
  });

  it("catches plain commercial wording in English and Arabic", () => {
    expect(detectConfidentialLeak("Bought from our supplier in Shenzhen").length).toBeGreaterThan(0);
    expect(detectConfidentialLeak("هامش الربح ٤٠٪").length).toBeGreaterThan(0);
    expect(detectConfidentialLeak("سعر الشراء منخفض").length).toBeGreaterThan(0);
  });

  it("does not fire on ordinary words that merely contain a term", () => {
    // An unbounded "supplier" match would hit "supplies" and train everyone to
    // ignore the check.
    expect(detectConfidentialLeak("Visionex supplies accessible tools.")).toEqual([]);
    expect(detectConfidentialLeak("A clear, well-priced product for readers.")).toEqual([]);
  });

  it("discards the whole draft rather than scrubbing it", () => {
    expect(engine).toContain('error: "confidentiality_violation"');
    // A partial scrub would leave the model believing that draft was fine.
    expect(engine).not.toMatch(/\.replace\(.*supplier/i);
  });

  it("shows the model only the id, table and already-public indexed text", () => {
    // An allow-list projection: nothing reads the underlying row, so a column
    // added to a source config cannot appear here — only what embed-content
    // chose to index does.
    const rendered = renderSourcesForPrompt([
      { source_table: "products", source_id: "p1", content: "Braille display, 40 cell" },
    ]);
    expect(rendered).toBe("- [p1] (products) Braille display, 40 cell");
  });
});

describe("the model is never called on confidential input", () => {
  // The guarantee this suite exists for. `generateAfterInputScreen` owns the
  // call, so these exercise the real control flow rather than asserting on the
  // shape of the source file.

  const clean = { sources: "- [p1] (products) Braille display, 40 cell", memory: "", avoid: "" };

  it("does not invoke the generator when a source record carries an internal field", async () => {
    const generate = vi.fn(async () => ({ topic: "anything" }));
    const result = await generateAfterInputScreen(
      { ...clean, sources: "- [p1] (products) Braille display. sourcePriceUsd 610." },
      generate,
    );

    expect(generate).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.error).toBe("confidential_input");
    expect(result.draft).toBeUndefined();
    expect(result.detail).toContain("sourcePriceUsd");
  });

  it("screens stored memory and the avoid-list too, not just the records", async () => {
    for (const field of ["memory", "avoid"] as const) {
      const generate = vi.fn(async () => ({ topic: "anything" }));
      const result = await generateAfterInputScreen(
        { ...clean, [field]: "- Owner said not to mention our supplier in Shenzhen." },
        generate,
      );
      expect(generate, `${field} was not screened`).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
    }
  });

  it("catches every INTERNAL_ONLY_FIELDS member on the way in", async () => {
    for (const field of INTERNAL_ONLY_FIELDS) {
      const generate = vi.fn(async () => ({ topic: "anything" }));
      await generateAfterInputScreen({ ...clean, sources: `- [p1] (products) ${field}: 12` }, generate);
      expect(generate, `${field} reached the model`).not.toHaveBeenCalled();
    }
  });

  it("does call the generator, once, when the input is clean", async () => {
    const generate = vi.fn(async () => ({ topic: "Braille displays" }));
    const result = await generateAfterInputScreen(clean, generate);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.draft).toEqual({ topic: "Braille displays" });
  });

  it("is wired into the engine ahead of the model call, and refuses on its verdict", () => {
    // The gate is only a guarantee if the engine actually routes through it.
    expect(engine).toContain("generateAfterInputScreen(");
    expect(engine).toContain("async () => {");
    expect(engine).toContain("structuredCompletionWithFallback({");
    // The provider call appears only as the gate's callback, never called
    // directly, so there is no second path around the screen.
    expect(engine.match(/structuredCompletionWithFallback\(/g)).toHaveLength(1);
    expect(engine).toContain("if (!gated.ok)");
  });

  it("keeps input and output screening on one shared list", () => {
    // Two lists would drift. Both screens call detectConfidentialLeak, which is
    // built from Phase 6's INTERNAL_ONLY_FIELDS.
    const rules = readFileSync("supabase/functions/_shared/content/proposalRules.ts", "utf8");
    expect(rules.match(/export const CONFIDENTIAL_TERMS/g)).toHaveLength(1);
    expect(rules).toContain("...INTERNAL_ONLY_FIELDS");
    expect(rules.match(/export function detectConfidentialLeak/g)).toHaveLength(1);
  });
});

describe("a content approval cannot be answered outside its own path", () => {
  // The stuck state this guards against: answering the approval alone leaves
  // content_proposals.state behind, and the proposal's own path then asks the
  // same engine and is told the approval is already decided — permanently.

  it("never invokes the engine for a content approval", async () => {
    const decide = vi.fn(async () => ({ data: { ok: true }, error: null }));
    const result = await decideUnlessContentApproval({ action_type: CONTENT_APPROVAL_TYPE }, decide);

    expect(decide).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.error).toBe("use_content_proposals");
    expect(result.result).toBeUndefined();
  });

  it("still runs the engine for every other approval type", async () => {
    for (const type of ["customer_escalation", "sourcing_approval", "refund", "discount", "other"]) {
      const decide = vi.fn(async () => ({ data: { ok: true }, error: null }));
      const result = await decideUnlessContentApproval({ action_type: type }, decide);
      expect(decide, `${type} was blocked`).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(true);
    }
  });

  it("refuses rather than guesses when the approval cannot be read", async () => {
    for (const missing of [null, undefined]) {
      const decide = vi.fn(async () => ({ data: null, error: null }));
      const result = await decideUnlessContentApproval(missing, decide);
      expect(decide).not.toHaveBeenCalled();
      expect(result.error).toBe("not_found");
    }
  });

  it("is wired into decide_approval ahead of the engine", () => {
    const block = ownerControl.slice(
      ownerControl.indexOf('case "decide_approval"'),
      ownerControl.indexOf('case "transition_escalation"'),
    );
    expect(block).toContain("decideUnlessContentApproval(");
    expect(block).toContain('.select("action_type")');
    // The engine call is the guard's callback, not a separate statement.
    expect(block.indexOf("decideUnlessContentApproval("))
      .toBeLessThan(block.indexOf('rpc("decide_owner_approval"'));
    expect(block).toContain('return json({ ok: false, reason: routed.error }, 409)');
  });

  it("keeps the WhatsApp listing free of content approvals", () => {
    const whatsapp = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    const query = whatsapp.slice(
      whatsapp.indexOf('.from("owner_approvals")'),
      whatsapp.indexOf(".limit(20)"),
    );
    expect(query).toContain('.neq("action_type", "content_publish")');
    // A reference the listing never surfaced cannot be found, so the existing
    // not-found reply handles it and no new branch was needed.
    expect(whatsapp).toContain("No pending decision with reference");
  });

  it("agrees with the frontend on the action type, in one place each", () => {
    const hook = readFileSync("src/hooks/useOwnerControl.ts", "utf8");
    expect(hook).toContain('export const CONTENT_APPROVAL_TYPE = "content_publish"');
    expect(CONTENT_APPROVAL_TYPE).toBe("content_publish");
    // Same literal the migration writes.
    expect(migration).toContain("'content_publish',");
  });
});

describe("a content approval does not expire out from under the proposal", () => {
  it("pushes expiry far beyond the seven-day default", () => {
    const now = new Date("2026-08-12T00:00:00Z");
    const expiry = Date.parse(contentApprovalExpiry(now));
    const sevenDays = now.getTime() + 7 * 86_400_000;

    expect(expiry).toBeGreaterThan(sevenDays);
    // Years, not days: "does not expire" said in the column that exists.
    expect(expiry).toBeGreaterThan(now.getTime() + 9 * 365 * 86_400_000);
  });

  it("applies it only to the content approval, by reference and by type", () => {
    const tail = engine.slice(engine.indexOf('rpc("create_content_proposal"'));
    expect(tail).toContain("contentApprovalExpiry()");
    expect(tail).toContain('.eq("reference", result.reference)');
    expect(tail).toContain('.eq("action_type", CONTENT_APPROVAL_TYPE)');
  });

  it("does not fail the proposal when the extension fails", () => {
    const tail = engine.slice(engine.indexOf('rpc("create_content_proposal"'));
    expect(tail).toContain("expiry extension failed");
    expect(tail).toContain("return { ok: true");
  });
});

describe("structural audit — no fourth path", () => {
  it("has exactly three call sites for the approval engine", () => {
    const sources = [
      ["owner-control", ownerControl],
      ["whatsapp-webhook", readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8")],
      ["migration", migration],
    ] as const;

    const calls = sources.map(([name, src]) => [
      name,
      (src.match(/rpc\("decide_owner_approval"|public\.decide_owner_approval\(/g) ?? []).length,
    ]);
    // owner-control (guarded), whatsapp-webhook (filtered), and
    // decide_content_proposal (the correct path). A fourth fails here.
    expect(calls).toEqual([["owner-control", 1], ["whatsapp-webhook", 1], ["migration", 1]]);
  });

  it("keeps one SQL writer for owner_approvals.state", () => {
    const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
    const writers = migrations.filter((f) =>
      /UPDATE public\.owner_approvals/.test(readFileSync(`supabase/migrations/${f}`, "utf8")));
    expect(writers).toEqual(["20260902000000_owner_control_and_escalations.sql"]);
  });

  it("lets no edge function write the state column directly", () => {
    const functions = readdirSync("supabase/functions", { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `supabase/functions/${e.name}/index.ts`)
      .filter((p) => existsSync(p));

    for (const path of functions) {
      const src = readFileSync(path, "utf8");
      const updates = [...src.matchAll(/from\("owner_approvals"\)[\s\S]{0,200}?\.update\(\{([^}]*)\}/g)];
      for (const [, fields] of updates) {
        expect(fields, `${path} updates owner_approvals.state directly`).not.toContain("state");
      }
    }
  });
});

describe("the ordering the pipeline promises", () => {
  it("screens the input after collecting sources and before the model", () => {
    const rateAt = engine.indexOf('rpc("check_ai_rate_limit"');
    const sourcesAt = engine.indexOf('rpc("match_embeddings"');
    const cooldownAt = engine.indexOf('rpc("content_sources_in_cooldown"');
    const gateAt = engine.indexOf("generateAfterInputScreen(");
    const modelAt = engine.indexOf("structuredCompletionWithFallback({");
    const outputAt = engine.indexOf("const leak = detectConfidentialLeak(");
    const saveAt = engine.indexOf('rpc("create_content_proposal"');

    for (const index of [rateAt, sourcesAt, cooldownAt, gateAt, modelAt, outputAt, saveAt]) {
      expect(index).toBeGreaterThan(-1);
    }
    // rate limit → sources → cooldown → input screen → model → output screen → save
    expect(rateAt).toBeLessThan(sourcesAt);
    expect(sourcesAt).toBeLessThan(cooldownAt);
    expect(cooldownAt).toBeLessThan(gateAt);
    expect(gateAt).toBeLessThan(modelAt);
    expect(modelAt).toBeLessThan(outputAt);
    expect(outputAt).toBeLessThan(saveAt);
  });
});

describe("duplicate prevention, three layers", () => {
  it("layer 1: normalises a topic to an exact-duplicate key", () => {
    expect(normalizeTopicKey("Accessible Braille Displays!")).toBe("accessible braille displays");
    expect(normalizeTopicKey("  accessible   braille displays  ")).toBe("accessible braille displays");
    expect(normalizeTopicKey("Accessible Braille Displays"))
      .toBe(normalizeTopicKey("accessible, braille — displays."));
  });

  it("layer 1: collapses Arabic letter-form and diacritic variants", () => {
    // أدوات and ادوات are the same word; a key that treats them as different
    // topics is not a duplicate check.
    expect(normalizeTopicKey("أدوات القراءة")).toBe(normalizeTopicKey("ادوات القراءة"));
    expect(normalizeTopicKey("مَكْتَبَة")).toBe(normalizeTopicKey("مكتبة"));
  });

  it("layer 1: keeps genuinely different topics apart", () => {
    expect(normalizeTopicKey("braille displays")).not.toBe(normalizeTopicKey("displays braille"));
    expect(normalizeTopicKey("kids games")).not.toBe(normalizeTopicKey("kids courses"));
  });

  it("layer 1: is enforced by a database index, not only by the caller", () => {
    expect(migration).toContain("content_proposals_live_topic_uniq");
    expect(migration).toMatch(/WHERE state IN \('PROPOSED', 'EDITED', 'APPROVED', 'SCHEDULED'\)/);
    // Terminal rows stay out of the constraint so a rejected topic is still
    // recorded — that record is how the engine learns not to repeat it.
    expect(migration).toContain("unique_violation");
  });

  it("layer 2: refuses a near-duplicate before writing anything", () => {
    expect(migration).toContain("match_content_proposals");
    expect(engine).toContain('rpc("match_content_proposals"');
    expect(engine).toContain('error: "near_duplicate"');
    expect(engine.indexOf('error: "near_duplicate"'))
      .toBeLessThan(engine.indexOf('rpc("create_content_proposal"'));
  });

  it("layer 3: skips sources used recently", () => {
    expect(migration).toContain("content_sources_in_cooldown");
    expect(engine).toContain('rpc("content_sources_in_cooldown"');
    expect(engine).toContain('error: "all_sources_on_cooldown"');
  });

  it("keeps the concurrency limit of layers 2 and 3 written down", () => {
    // Layers 2 and 3 are check-then-act and are not race-safe; only the exact
    // check is, because it is an index inside the transaction. Pinning the note
    // stops the caveat being quietly deleted while the behaviour stays.
    expect(engine).toContain("KNOWN LIMITATION");
    expect(engine).toContain("not race-safe under concurrent generation");
  });

  it("feeds rejected topics back as an explicit avoid-list", () => {
    const { memory, avoid } = buildMemoryContext([
      { memory_type: "rejected_topic", topic: "VX coin giveaway", lesson: "Owner rejected this." },
      { memory_type: "style_preference", topic: null, lesson: "Prefer short sentences." },
      { memory_type: "approved_topic", topic: "Braille displays", lesson: "This angle works." },
    ]);
    expect(avoid).toContain("VX coin giveaway");
    expect(memory).toContain("Prefer short sentences.");
    expect(memory).toContain("This angle works.");
    // A rejected topic must not read as general guidance.
    expect(memory).not.toContain("VX coin giveaway");
  });

  it("tells the model not to reword a rejected idea", () => {
    const system = buildContentWriterSystem(
      { section: "products", avoid: "- VX coin giveaway: Owner rejected this." },
      "en",
    );
    expect(system).toMatch(/do not reword them into a near-identical idea/i);
  });
});

describe("grounding", () => {
  const supplied = [
    { source_table: "products", source_id: "p1", content: "x" },
    { source_table: "products", source_id: "p2", content: "y" },
  ];

  it("keeps only ids that were actually retrieved and shown", () => {
    // A model can cite a record it was never given.
    expect(validateSourceRefs(["p1", "p9"], supplied)).toEqual([
      { source_table: "products", source_id: "p1" },
    ]);
  });

  it("drops duplicates and non-strings", () => {
    expect(validateSourceRefs(["p1", "p1", 7, null], supplied)).toHaveLength(1);
    expect(validateSourceRefs("p1", supplied)).toEqual([]);
    expect(validateSourceRefs(undefined, supplied)).toEqual([]);
  });

  it("refuses a draft that cites nothing real", () => {
    expect(engine).toContain('error: "no_valid_sources"');
  });

  it("stores the surviving references on the proposal", () => {
    expect(engine).toContain("source_refs: sourceRefs");
    expect(migration).toContain("source_refs   jsonb NOT NULL DEFAULT '[]'");
  });
});

describe("nothing can publish", () => {
  it("gives PUBLISHED no inbound transition", () => {
    const guard = migration.slice(
      migration.indexOf("enforce_content_proposal_transition"),
      migration.indexOf("DROP TRIGGER IF EXISTS content_proposals_transition"),
    );
    const allowedLists = [...guard.matchAll(/ARRAY\[([^\]]*)\]/g)].map((m) => m[1]);
    for (const list of allowedLists) {
      expect(list, "no transition may lead to PUBLISHED").not.toContain("PUBLISHED");
    }
    // It is in the vocabulary so a later migration is purely additive.
    expect(migration).toContain("'PUBLISHED'");
  });

  it("makes SCHEDULED terminal in this phase", () => {
    expect(migration).toMatch(/WHEN 'SCHEDULED' THEN ARRAY\[\]::text\[\]/);
  });

  it("ships no social API anywhere in the change", () => {
    const surfaces = [migration, engine, ownerControl, dashboard];
    for (const source of surfaces) {
      expect(source).not.toMatch(/graph\.facebook\.com|api\.instagram\.com|open-api\.tiktok|googleapis\.com\/youtube/i);
      expect(source).not.toMatch(/access_token.*facebook|instagram_business_account/i);
    }
  });

  it("keeps the calendar free of anything a publisher would need", () => {
    const calendar = migration.slice(
      migration.indexOf("CREATE TABLE IF NOT EXISTS public.content_calendar"),
      migration.indexOf("COMMENT ON TABLE public.content_calendar"),
    );
    expect(calendar).toContain("'PLANNED', 'CANCELLED'");
    expect(calendar).not.toContain("PUBLISHED");
    expect(calendar).not.toMatch(/external_id|post_id|remote_id|published_at/);
  });

  it("says so in the interface rather than only in the schema", () => {
    expect(dashboard).toContain("content.noPublishNotice");
  });
});

describe("approval goes through the existing engine", () => {
  it("reuses the existing action type rather than adding one", () => {
    expect(migration).toContain("'content_publish'");
    // The CHECK constraint on owner_approvals.action_type is untouched.
    expect(migration).not.toMatch(/ALTER TABLE public\.owner_approvals[\s\S]{0,200}action_type/);
  });

  it("calls decide_owner_approval instead of deciding by itself", () => {
    const decide = migration.slice(migration.indexOf("FUNCTION public.decide_content_proposal"));
    expect(decide).toContain("public.decide_owner_approval(");
    // If the existing engine refuses — already decided, expired — so does this.
    expect(decide).toContain("IF NOT (_decision->>'ok')::boolean THEN");
  });

  it("creates the proposal and its approval in one transaction", () => {
    const create = migration.slice(
      migration.indexOf("FUNCTION public.create_content_proposal"),
      migration.indexOf("FUNCTION public.decide_content_proposal"),
    );
    expect(create).toContain("INSERT INTO public.owner_approvals");
    expect(create).toContain("INSERT INTO public.content_proposals");
  });

  it("requires approval before a proposal can be scheduled", () => {
    const schedule = migration.slice(migration.indexOf("FUNCTION public.schedule_content_proposal"));
    expect(schedule).toContain("IF _proposal.state <> 'APPROVED' THEN");
    expect(schedule).toContain("'not_approved'");
  });

  it("records approval, rejection and correction in the existing feedback log", () => {
    expect(migration).toContain("'owner_approval'");
    expect(migration).toContain("'owner_rejection'");
    expect(migration).toContain("'owner_correction'");
    // Two statements cover the three event types: approval and rejection share
    // one insert that picks the type with a CASE.
    expect(migration.match(/INSERT INTO public\.ai_feedback_events/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps before, after and the changed-field list on an edit", () => {
    const edit = migration.slice(migration.indexOf("FUNCTION public.record_content_proposal_edit"));
    expect(edit).toContain("'before', jsonb_build_object");
    expect(edit).toContain("'after',  jsonb_build_object");
    expect(edit).toContain("'changed'");
    expect(edit).toContain("revision = revision + 1");
  });

  it("never edits the previous draft when asked for another", () => {
    const create = migration.slice(migration.indexOf("FUNCTION public.create_content_proposal"));
    expect(create).toContain("SET state = 'SUPERSEDED', superseded_by_id = _row.id");
    expect(create).toContain("supersedes_id");
  });
});

describe("learning stays contextual", () => {
  it("stores lessons as sentences, not settings", () => {
    expect(migration).toContain("lesson        text NOT NULL");
    expect(engine).toContain("buildMemoryContext");
  });

  it("cannot reach routing, providers, prompts on disk, pricing or permissions", () => {
    for (const forbidden of [
      /UPDATE public\.pricing_rules/, /UPDATE public\.site_settings/,
      /UPDATE public\.user_roles/, /provider\s*=/, /model\s*:=/,
    ]) {
      expect(migration).not.toMatch(forbidden);
    }
    expect(engine).not.toMatch(/GENERATORS\[[^\]]+\]\s*=|\.buildSystem\s*=/);
  });

  it("keeps memory distinct from the event log rather than replacing it", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.content_memory");
    expect(migration).toContain("INSERT INTO public.ai_feedback_events");
  });
});

describe("security", () => {
  it("gives the three tables admin read and no write policy", () => {
    for (const table of ["content_proposals", "content_calendar", "content_memory"]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toMatch(new RegExp(`ON public\\.${table} FOR SELECT TO authenticated`));
      // An admin session in a browser still cannot write these directly.
      expect(migration).not.toMatch(new RegExp(`ON public\\.${table} FOR (INSERT|UPDATE|DELETE)`));
    }
  });

  it("grants every write function to service_role only", () => {
    const functions = [
      "create_content_proposal", "decide_content_proposal",
      "record_content_proposal_edit", "schedule_content_proposal",
      "match_content_proposals", "content_sources_in_cooldown",
    ];
    for (const fn of functions) {
      expect(migration, fn).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}`));
      expect(migration, fn).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[^;]*TO service_role`));
      expect(migration, fn).not.toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[^;]*TO (anon|authenticated)`));
    }
  });

  it("puts every content action behind the existing admin check", () => {
    const adminCheck = ownerControl.indexOf('return json({ error: "Admin access required" }, 403)');
    expect(adminCheck).toBeGreaterThan(-1);
    for (const action of [
      "propose_content", "decide_proposal", "edit_proposal",
      "regenerate_proposal", "schedule_proposal",
    ]) {
      expect(ownerControl).toContain(`case "${action}"`);
      // Every case sits after the role check, so none can be reached without it.
      expect(ownerControl.indexOf(`case "${action}"`)).toBeGreaterThan(adminCheck);
    }
  });

  it("never lets the browser hold the service role", () => {
    const hook = readFileSync("src/hooks/useOwnerControl.ts", "utf8");
    expect(hook).not.toMatch(/SERVICE_ROLE|service_role/);
    for (const action of ["propose_content", "decide_proposal", "edit_proposal", "regenerate_proposal"]) {
      expect(hook).toContain(`action: "${action}"`);
    }
    expect(hook).toContain('supabase.functions.invoke("owner-control"');
  });

  it("validates references against the reference alphabet", () => {
    expect(ownerControl).toContain("REFERENCE_PATTERN");
    expect(ownerControl).toMatch(/\^\[23456789ABCDEFGHJKMNPQRSTUVWXYZ\]\{5\}\$/);
  });
});

describe("cost is bounded by the existing guards", () => {
  it("checks the project's rate limiter before generating", () => {
    expect(engine).toContain('rpc("check_ai_rate_limit"');
    expect(engine.indexOf('rpc("check_ai_rate_limit"')).toBeLessThan(engine.indexOf("structuredCompletionWithFallback("));
  });

  it("fails closed when the limiter cannot be read", () => {
    // Unlike a chat reply, a refused draft costs nothing and an unmetered
    // generation loop costs real money.
    expect(engine).toContain('if (rateError) return { ok: false, error: "rate_limit_unavailable" }');
  });

  it("logs usage against the same table the limiter reads", () => {
    expect(engine).toContain('from("ai_usage_log")');
  });

  it("caps how much is retrieved and drafted per run", () => {
    expect(engine).toMatch(/MAX_SOURCES_PER_DRAFT = \d+/);
    expect(engine).toMatch(/MAX_MEMORY_ROWS = \d+/);
    // One proposal per call — no sweep over the whole index.
    expect(engine).not.toMatch(/for \(const section of CONTENT_SECTIONS\)/);
  });

  it("adds no AI provider and no new external API", () => {
    expect(engine).not.toMatch(/anthropic|gemini|mistral|groq|api\.openai\.com/i);
    expect(engine).toContain('from "./aiProvider.ts"');
  });

  it("re-embeds nothing that is already indexed", () => {
    // Two embeddings per run: the section seed and the drafted topic. The
    // corpus itself is never re-embedded here.
    expect(engine.match(/createEmbedding\(/g)).toHaveLength(2);
  });
});

describe("no new Edge Function", () => {
  it("adds no function of its own, and leaves quota headroom", () => {
    const functions = readdirSync("supabase/functions", { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
      .map((entry) => entry.name);

    // The rule this guards is that the content engine reuses ai-generate
    // instead of minting a function per capability.
    for (const invented of ["content-writer", "content-engine", "content-generate", "social-publish"]) {
      expect(existsSync(`supabase/functions/${invented}`), `${invented} must not exist`).toBe(false);
    }

    // The count was pinned at a snapshot, which any unrelated function tripped.
    // What actually matters is the ceiling: Supabase rejects the 101st function
    // with a 402 that reads like a bundling error, so keep real headroom.
    expect(functions.length).toBeLessThanOrEqual(95);
  });

  it("routes everything through ai-generate and owner-control", () => {
    expect(existsSync("supabase/functions/ai-generate/index.ts")).toBe(true);
    expect(existsSync("supabase/functions/owner-control/index.ts")).toBe(true);
    // The engine is a shared module, not an endpoint.
    expect(existsSync("supabase/functions/_shared/contentEngine.ts")).toBe(true);
    expect(engine).not.toContain("Deno.serve");
  });

  it("is not named in the retirement manifest", () => {
    const manifest = JSON.parse(readFileSync("supabase/retirement-manifest.json", "utf8"));
    const slugs = manifest.retire.map((entry: { slug: string }) => entry.slug);
    expect(slugs).not.toContain("ai-generate");
    expect(slugs).not.toContain("owner-control");
  });
});

describe("proposed time", () => {
  it("accepts a usable future timestamp", () => {
    const future = new Date(Date.now() + 7_200_000).toISOString();
    expect(normalizeProposedTime(future)).toBe(future);
  });

  it("replaces a past or unparseable one rather than storing it", () => {
    for (const bad of ["not a date", "", null, undefined, "1999-01-01T00:00:00Z"]) {
      expect(Date.parse(normalizeProposedTime(bad))).toBeGreaterThan(Date.now());
    }
  });
});
