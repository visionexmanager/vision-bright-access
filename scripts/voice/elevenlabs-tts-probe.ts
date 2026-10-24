// Direct ElevenLabs TTS smoke test. Keys are never printed.
// deno run --allow-net --allow-env --allow-write scripts/voice/elevenlabs-tts-probe.ts
const key = Deno.env.get("ELEVENLABS_API_KEY")?.trim();
if (!key) {
  console.error("ELEVENLABS_API_KEY is not configured in GitHub Actions secrets.");
  Deno.exit(2);
}
const samples = [
  { id: "en", text: "Hello, this is a Visionex text to speech test." },
  { id: "ar", text: "مرحبا، هذا اختبار تحويل النص إلى صوت من فيجنكس." },
];
await Deno.mkdir("elevenlabs-probe", { recursive: true });
let failures = 0;
for (const sample of samples) {
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=opus_48000_32", {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/ogg" },
      body: JSON.stringify({
        text: sample.text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!response.ok) {
      console.error(`FAIL ${sample.id}: ElevenLabs returned HTTP ${response.status}`);
      await response.body?.cancel();
      failures++;
      continue;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const header = new TextDecoder("latin1").decode(bytes.slice(0, 256));
    const valid = bytes.byteLength > 0 && header.startsWith("OggS") && header.includes("OpusHead");
    if (!valid) {
      console.error(`FAIL ${sample.id}: response was not a non-empty Ogg/Opus audio file (${bytes.byteLength} bytes)`);
      failures++;
      continue;
    }
    await Deno.writeFile(`elevenlabs-probe/elevenlabs-${sample.id}.ogg`, bytes);
    console.log(`PASS ${sample.id}: HTTP 200, Ogg/Opus verified, ${bytes.byteLength} bytes`);
  } catch {
    console.error(`FAIL ${sample.id}: network or response-processing error`);
    failures++;
  }
}
console.log(failures ? `ElevenLabs smoke test failed: ${failures} sample(s).` : "ElevenLabs English and Arabic smoke tests passed.");
Deno.exit(failures ? 1 : 0);
