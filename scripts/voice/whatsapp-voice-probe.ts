// The WhatsApp voice reply, end to end, without messaging anybody.
//
//   deno run --allow-net --allow-env --allow-write --node-modules-dir=none \
//     scripts/voice/whatsapp-voice-probe.ts <out-dir>
//
// For a fixed English and a fixed Arabic sentence it runs the production code:
//
//   synthesiseSpeech   the exact model, voice, style and format a sender gets
//   Ogg/Opus check     what WhatsApp requires of a voice note
//   transcribeVoice    the webhook's own speech-to-text, to prove the words and
//                      the language survive the voice
//   uploadWhatsAppMedia  Meta's media store accepts the file
//   DELETE media       and the upload is removed again
//
// No message is sent, so no recipient is needed. The sentences are written
// here and are nobody's words. Keys are read from the environment and never
// printed; the audio is written to <out-dir> so a person can listen to it.
//
// Exits non-zero when any step fails.

import { GRAPH_BASE } from "../../supabase/functions/_shared/meta.ts";
import {
  DEFAULT_VOICE,
  SPEECH_MODEL,
  synthesiseSpeech,
  uploadWhatsAppMedia,
} from "../../supabase/functions/_shared/whatsappVoiceReply.ts";
import { transcribeVoice } from "../../supabase/functions/_shared/whatsappTranscribe.ts";

const SAMPLES = [
  {
    id: "en",
    text: "Hello, I'm your Visionex assistant. Your order is on its way, and I'm here if you need anything else.",
    script: /[A-Za-z]/g,
    words: ["visionex", "order", "way"],
  },
  {
    id: "ar",
    text: "مرحبا، أنا مساعد فيجنكس. طلبك في الطريق إليك، وأنا هنا إذا احتجت إلى أي شيء آخر.",
    script: /[\u0600-\u06FF]/g,
    words: ["طلب", "الطريق"],
  },
];

const outDir = Deno.args[0] ?? "voice-probe";
await Deno.mkdir(outDir, { recursive: true });

const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const token = Deno.env.get("WHATSAPP_TOKEN") ?? "";
let failed = 0;
const say = (line: string) => console.log(line);
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  say(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

say(`model ${SPEECH_MODEL}, voice ${DEFAULT_VOICE}`);

for (const sample of SAMPLES) {
  say(`\n## ${sample.id}`);
  const speech = await synthesiseSpeech({ text: sample.text });
  check("synthesised", speech.ok);
  if (!speech.ok) continue;

  const bytes = speech.bytes;
  await Deno.writeFile(`${outDir}/whatsapp-voice-${sample.id}.ogg`, bytes);
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 64));
  check("mime is audio/ogg", speech.mimeType === "audio/ogg", speech.mimeType);
  check("Ogg container", head.startsWith("OggS"));
  check("Opus codec", head.includes("OpusHead"));
  // OpusHead: 8-byte magic, version, then the channel count.
  const opusAt = head.indexOf("OpusHead");
  const channels = opusAt >= 0 ? bytes[opusAt + 9] : -1;
  check("mono", channels === 1, `channels=${channels}`);
  check("size within WhatsApp's 16 MB audio limit", bytes.byteLength < 16 * 1024 * 1024, `${bytes.byteLength} bytes`);

  const heard = await transcribeVoice({ bytes, mimeType: speech.mimeType });
  if (!heard.ok) {
    check("transcribed back", false, heard.reason);
  } else {
    const text = heard.text.toLowerCase();
    const letters = text.replace(/[\s\p{P}\d]/gu, "").length || 1;
    const inScript = (text.match(sample.script) ?? []).length / letters;
    check("heard in the same language", inScript > 0.8, `${Math.round(inScript * 100)}% in the expected script`);
    const found = sample.words.filter((w) => text.includes(w));
    check("key words intelligible", found.length === sample.words.length, `${found.length}/${sample.words.length}`);
  }

  if (!phoneNumberId || !token) {
    check("WhatsApp upload", false, "WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TOKEN not configured");
    continue;
  }
  const mediaId = await uploadWhatsAppMedia({ phoneNumberId, token, bytes, mimeType: speech.mimeType });
  check("accepted by WhatsApp media upload", mediaId !== null);
  if (mediaId) {
    const removed = await fetch(`${GRAPH_BASE}/${mediaId}?phone_number_id=${phoneNumberId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.ok).catch(() => false);
    check("test upload deleted", removed);
  }
}

say(failed ? `\n${failed} check(s) failed` : "\nALL CHECKS PASSED");
Deno.exit(failed ? 1 : 0);
