import { describe, expect, it } from "vitest";
import {
  INTENT_MIN_MARGIN,
  INTENT_MIN_SIMILARITY,
  corpusHash,
  decideIntent,
  ensureIntentIndex,
  guessIntent,
  intentCorpus,
  looksLikeARequest,
  suggestableNodes,
  type IntentDb,
} from "../../supabase/functions/_shared/whatsappIntent";
import { aliasesOf, nodeById } from "../../supabase/functions/_shared/whatsappCatalog";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages";
import { say } from "../../supabase/functions/_shared/whatsappStrings";

// A tiny deterministic "embedding": hashed character trigrams, so strings that
// share letters are close. Enough to drive every branch without a provider.
const DIM = 64;
const embedOne = (text: string): number[] => {
  const v = new Array(DIM).fill(0);
  const t = ` ${text.toLowerCase()} `;
  for (let i = 0; i < t.length - 2; i++) {
    let h = 0;
    for (const ch of t.slice(i, i + 3)) h = (h * 31 + ch.codePointAt(0)!) % DIM;
    v[h] += 1;
  }
  return v;
};
const embed = async (texts: string[]) => texts.map(embedOne);
const cosine = (a: number[], b: number[]) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

/** An in-memory stand-in for the two tables and the one function the module uses. */
function fakeDb() {
  const rows: { catalog_hash: string; node_id: string; content: string; embedding: number[] }[] = [];
  const db: IntentDb = {
    from: () => ({
      select: () => ({
        eq: (_c: string, hash: string) => ({
          limit: async () => ({ data: rows.filter((r) => r.catalog_hash === hash).slice(0, 1), error: null }),
        }),
      }),
      upsert: async (batch: { catalog_hash: string; node_id: string; content: string; embedding: string }[]) => {
        for (const row of batch) {
          if (rows.some((r) => r.catalog_hash === row.catalog_hash && r.node_id === row.node_id && r.content === row.content)) continue;
          rows.push({ ...row, embedding: JSON.parse(row.embedding) });
        }
        return { error: null };
      },
      delete: () => ({
        neq: async (_c: string, hash: string) => {
          for (let i = rows.length - 1; i >= 0; i--) if (rows[i].catalog_hash !== hash) rows.splice(i, 1);
          return { error: null };
        },
      }),
    }),
    rpc: async (_fn, args) => {
      const query = JSON.parse(args.query_embedding as string) as number[];
      const data = rows
        .filter((r) => r.catalog_hash === args.p_hash)
        .map((r) => ({ node_id: r.node_id, similarity: cosine(query, r.embedding) }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, Number(args.match_count));
      return { data, error: null };
    },
  };
  return { db, rows };
}

describe("the corpus of features", () => {
  it("covers only features the router can open by typing, and none twice", () => {
    const nodes = suggestableNodes();
    expect(nodes.length).toBeGreaterThan(10);
    for (const node of nodes) {
      expect(aliasesOf(node, "ar").length + aliasesOf(node, "en").length, node.id).toBeGreaterThan(0);
    }
    const rows = intentCorpus();
    expect(new Set(rows.map((r) => `${r.nodeId}|${r.content}`)).size).toBe(rows.length);
    expect(rows.every((r) => r.content.length >= 2 && r.content.length <= 300)).toBe(true);
  });

  it("fingerprints the corpus: the same twice, different when anything changes", () => {
    const rows = intentCorpus();
    expect(corpusHash(rows)).toBe(corpusHash([...rows].reverse()));
    expect(corpusHash(rows)).not.toBe(corpusHash(rows.slice(1)));
  });
});

describe("deciding", () => {
  it("suggests a clear winner", () => {
    const d = decideIntent([{ nodeId: "a", similarity: 0.7 }, { nodeId: "b", similarity: 0.4 }, { nodeId: "a", similarity: 0.3 }]);
    expect(d).toMatchObject({ kind: "suggest", nodeId: "a" });
  });

  it("says nothing when the match is weak, ambiguous, or missing", () => {
    expect(decideIntent([{ nodeId: "a", similarity: INTENT_MIN_SIMILARITY - 0.01 }])).toMatchObject({ kind: "none", reason: "weak" });
    expect(decideIntent([{ nodeId: "a", similarity: 0.7 }, { nodeId: "b", similarity: 0.7 - INTENT_MIN_MARGIN / 2 }])).toMatchObject({ kind: "none", reason: "ambiguous" });
    expect(decideIntent([])).toMatchObject({ kind: "none", reason: "no_matches" });
    expect(decideIntent([{ nodeId: "a", similarity: Number.NaN }])).toMatchObject({ kind: "none", reason: "no_matches" });
  });

  it("two rows of one feature are not ambiguity", () => {
    expect(decideIntent([{ nodeId: "a", similarity: 0.71 }, { nodeId: "a", similarity: 0.7 }])).toMatchObject({ kind: "suggest" });
  });
});

describe("what counts as a request", () => {
  it("accepts a short phrase and refuses links, numbers and long talk", () => {
    expect(looksLikeARequest("turn my document into word")).toBe(true);
    expect(looksLikeARequest("حوّل ملفي")).toBe(true);
    for (const text of ["", "ok", "https://example.com/a", "+961 70 123 456", "a b c d e f g h i j k"]) {
      expect(looksLikeARequest(text), text).toBe(false);
    }
  });
});

describe("the index and the guess", () => {
  it("builds once, finds a feature by its own words, and offers what to type", async () => {
    const { db, rows } = fakeDb();
    const corpus = intentCorpus();
    const hash = corpusHash(corpus);
    expect(await ensureIntentIndex(db, embed, corpus, hash)).toBe(true);
    const built = rows.length;
    expect(built).toBe(corpus.length);
    expect(await ensureIntentIndex(db, embed, corpus, hash)).toBe(true);
    expect(rows.length).toBe(built);

    // The English title of a feature, typed back, is closest to that feature.
    const node = suggestableNodes().find((n) => n.title.en.length > 8)!;
    const result = await guessIntent({ db, embed, text: node.title.en, language: "en", isOn: () => true });
    expect(result.guess?.nodeId).toBe(node.id);
    expect(result.guess?.alias).toBe(aliasesOf(node, "en")[0]);
    expect(nodeById(result.guess!.nodeId)).not.toBeNull();
  });

  it("offers nothing for a feature that is switched off, or for unrelated words", async () => {
    const { db } = fakeDb();
    const node = suggestableNodes().find((n) => n.title.en.length > 8)!;
    const off = await guessIntent({ db, embed, text: node.title.en, language: "en", isOn: () => false });
    expect(off.guess).toBeNull();
    expect(off.reason).toBe("unavailable");
    // The toy embedding above is too dense to tell nonsense from a match, so
    // "unrelated" is stated directly: the database reports low similarity.
    const far: IntentDb = { ...db, rpc: async () => ({ data: [{ node_id: node.id, similarity: 0.2 }], error: null }) };
    const none = await guessIntent({ db: far, embed, text: "qqqq zzzz xxxx", language: "en", isOn: () => true });
    expect(none.guess).toBeNull();
    expect(none.reason).toBe("weak");
  });

  it("falls quiet when the index cannot be built or the provider fails", async () => {
    const broken: IntentDb = {
      from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: null, error: { code: "x" } }) }) }) }),
      rpc: async () => ({ data: null, error: { code: "x" } }),
    };
    const result = await guessIntent({ db: broken, embed, text: "convert a file", language: "en", isOn: () => true });
    expect(result).toMatchObject({ guess: null, reason: "index_unavailable" });
  });
});

describe("the sentence that asks", () => {
  it("exists in all twenty languages with both placeholders", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const text = say("intentSuggest", language as never);
      expect(text, language).toContain("{title}");
      expect(text, language).toContain("{alias}");
    }
  });
});
