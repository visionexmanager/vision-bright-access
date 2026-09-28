// Usage from an OpenAI-shaped SSE stream, read on the way through.
//
// Providers put a stream's token counts in its last event: OpenAI and Groq in
// a usage-only chunk (`"choices": []`) when asked with stream_options.
// include_usage, Mistral in its final chunk, Groq also under `x_groq.usage`,
// and our Gemini transform in a usage-only chunk of its own. This passes every
// byte on unchanged except that usage-only chunk, which no consumer asked for
// and a client parser expecting `choices[0]` could trip on; it keeps the last
// usage it saw, the model the provider named, and how many bytes of answer
// text went by.
//
// When the stream ends — finished, cancelled by its reader (a user who closed
// the page, a language gate that refused it) or broken — `onEnd` is called
// exactly once with what was seen. The caller decides what to report; a stream
// that ended without usage is its to estimate, and to say so.
//
// Pure: no provider, no database. Vitest drives it with synthetic streams.

export type StreamEnd = "done" | "cancelled" | "error";

export interface StreamUsageSeen {
  /** The provider's raw usage object from the last event that carried one. */
  usage?: Record<string, unknown>;
  /** The model the provider named in its chunks, when it did. */
  model?: string;
  /** UTF-8 bytes of answer text (delta.content) that went through. */
  outputBytes: number;
  end: StreamEnd;
}

const encoder = new TextEncoder();

function usageIn(evt: Record<string, unknown>): Record<string, unknown> | undefined {
  const direct = evt.usage;
  if (direct && typeof direct === "object") return direct as Record<string, unknown>;
  const groq = (evt.x_groq as { usage?: unknown } | undefined)?.usage;
  if (groq && typeof groq === "object") return groq as Record<string, unknown>;
  return undefined;
}

/** A chunk that carries usage and nothing a reader wants: no choices at all. */
function usageOnly(evt: Record<string, unknown>): boolean {
  return Array.isArray(evt.choices) && evt.choices.length === 0 && usageIn(evt) !== undefined;
}

export function meterSseStream(
  src: ReadableStream<Uint8Array>,
  onEnd: (seen: StreamUsageSeen) => void,
): ReadableStream<Uint8Array> {
  const reader = src.getReader();
  const decoder = new TextDecoder();
  const seen: Omit<StreamUsageSeen, "end"> = { outputBytes: 0 };
  let pending = "";
  let ended = false;
  const finish = (end: StreamEnd) => {
    if (ended) return;
    ended = true;
    try {
      onEnd({ ...seen, end });
    } catch {
      // The meter never reaches the reader.
    }
  };

  /** Inspect whole lines; return the text to hand on (usage-only lines removed). */
  const filterLines = (text: string): string => {
    let out = "";
    let from = 0;
    for (;;) {
      const nl = text.indexOf("\n", from);
      if (nl === -1) {
        pending = text.slice(from);
        return out;
      }
      const raw = text.slice(from, nl + 1);
      from = nl + 1;
      const line = raw.replace(/\r?\n$/, "");
      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (payload && payload !== "[DONE]") {
          try {
            const evt = JSON.parse(payload) as Record<string, unknown>;
            const usage = usageIn(evt);
            if (usage) seen.usage = usage;
            if (typeof evt.model === "string") seen.model = evt.model;
            const choices = Array.isArray(evt.choices) ? evt.choices : [];
            for (const c of choices) {
              const content = (c as { delta?: { content?: unknown } })?.delta?.content;
              if (typeof content === "string") seen.outputBytes += encoder.encode(content).length;
            }
            if (usageOnly(evt)) continue; // dropped: the blank line after it is harmless
          } catch {
            // Not JSON we understand: pass it on untouched.
          }
        }
      }
      out += raw;
    }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (error) {
          finish("error");
          controller.error(error);
          return;
        }
        if (chunk.done) {
          // A last line with no newline after it: judge it like any other, and
          // hand it on without the newline we added to judge it.
          const rest = pending + decoder.decode();
          pending = "";
          if (rest) {
            const out = filterLines(`${rest}\n`);
            const tail = out.endsWith("\n") ? out.slice(0, -1) : out;
            if (tail) controller.enqueue(encoder.encode(tail));
          }
          finish("done");
          controller.close();
          return;
        }
        const out = filterLines(pending + decoder.decode(chunk.value, { stream: true }));
        if (out) {
          controller.enqueue(encoder.encode(out));
          return;
        }
      }
    },
    cancel(reason) {
      finish("cancelled");
      return reader.cancel(reason);
    },
  });
}
