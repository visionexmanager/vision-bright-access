// ─── Audio Converter Module ───────────────────────────────────────────────────
// Browser-native path: AudioContext decode/render, then either a manual PCM→WAV
// encode (always available, no codec dependency) or MediaRecorder for webm.
// MP3/OGG need a real encoder (lamejs / libvorbis.wasm) we don't ship, so they
// go to the server like the other heavy formats (FLAC, AAC, M4A, Opus) — to the
// same ffmpeg the WhatsApp assistant converts with, on Visionex's own machine,
// behind an Edge Function that holds the token a browser cannot.
//
// That path used to be a stub that waited six hundred milliseconds and said the
// conversion was "available in Phase 12 API integration". Phase 12 was never
// built, and this page is linked from the navbar.
//
// WMA is gone from the outputs and stays an input: ffmpeg reads one and will
// not write one, and offering a format nothing can produce is a menu entry that
// can only fail.
//
// Note: MediaRecorder cannot produce "audio/mpeg" or "audio/wav" containers in
// any mainstream browser — only webm (opus, Chromium/Firefox) — so those two
// were previously listed as browser-working and always threw partway through
// (MediaRecorder constructor rejects the unsupported mimeType). WAV is now
// encoded manually instead of routed through MediaRecorder.

import type {
  ConverterModule,
  ConversionResult,
  AudioOptions,
  ConversionOptions,
} from "@/lib/types/fileStudio";
import { AUDIO_FORMATS } from "@/lib/types/fileStudio";
import { convertOnServer, SERVER_AUDIO_OUTPUTS } from "../serverConvert";

const BROWSER_OUTPUT_FORMATS = ["wav", "webm"];

export const AudioModule: ConverterModule = {
  moduleType: "audio",
  supportedInputFormats: [...AUDIO_FORMATS],
  // What can be *read* is every audio format ffmpeg opens; what can be
  // produced is what the service will actually emit. Offering a format nobody
  // can produce is a menu entry that can only ever fail, and that was most of
  // why this page looked broken.
  supportedOutputFormats: [...SERVER_AUDIO_OUTPUTS],
  canHandleInBrowser: true,

  async convert(
    file: File,
    options: ConversionOptions,
    onProgress: (pct: number) => void
  ): Promise<ConversionResult> {
    const opts = options as AudioOptions;
    const start = Date.now();

    // For formats not supported by browser MediaRecorder, delegate to server.
    if (!BROWSER_OUTPUT_FORMATS.includes(opts.targetFormat)) {
      return serverSideStub(file, opts, onProgress, start);
    }

    try {
      onProgress(10);
      const arrayBuffer = await file.arrayBuffer();
      onProgress(25);

      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      onProgress(50);

      // Apply trim if requested
      const trimmedBuffer = opts.trimStart !== undefined || opts.trimEnd !== undefined
        ? trimAudioBuffer(audioBuffer, opts.trimStart, opts.trimEnd)
        : audioBuffer;

      // Apply gain/normalize via OfflineAudioContext, then encode
      const renderedBuffer = await applyGain(trimmedBuffer, opts);
      const blob = opts.targetFormat === "wav"
        ? encodeWav(renderedBuffer)
        : await recordAsWebm(renderedBuffer);
      await audioCtx.close();

      onProgress(100);
      const url = URL.createObjectURL(blob);

      return {
        success: true,
        resultUrl: url,
        resultBlob: blob,
        resultSize: blob.size,
        processingMs: Date.now() - start,
        metadata: {
          duration: trimmedBuffer.duration,
          sampleRate: trimmedBuffer.sampleRate,
          channels: trimmedBuffer.numberOfChannels,
          format: opts.targetFormat,
        },
      };
    } catch (err) {
      return {
        success: false,
        processingMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Audio conversion failed",
      };
    }
  },
};

function trimAudioBuffer(
  buf: AudioBuffer,
  startSec?: number,
  endSec?: number
): AudioBuffer {
  const start = startSec ?? 0;
  const end   = endSec ?? buf.duration;
  const startFrame = Math.floor(start * buf.sampleRate);
  const endFrame   = Math.floor(Math.min(end, buf.duration) * buf.sampleRate);
  const length = endFrame - startFrame;

  const ctx = new OfflineAudioContext(buf.numberOfChannels, length, buf.sampleRate);
  const newBuf = ctx.createBuffer(buf.numberOfChannels, length, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    newBuf.copyToChannel(buf.getChannelData(ch).slice(startFrame, endFrame), ch);
  }
  return newBuf;
}

async function applyGain(buf: AudioBuffer, opts: AudioOptions): Promise<AudioBuffer> {
  const offCtx = new OfflineAudioContext(
    buf.numberOfChannels,
    buf.length,
    buf.sampleRate
  );
  const src = offCtx.createBufferSource();
  src.buffer = buf;

  const gain = offCtx.createGain();
  gain.gain.value = opts.normalize ? 1.2 : 1.0;
  src.connect(gain);
  gain.connect(offCtx.destination);
  src.start();
  return offCtx.startRendering();
}

// Manual PCM → WAV encode. No codec/container support needed from the
// browser, so this works identically everywhere (unlike MediaRecorder,
// which can't emit a "audio/wav" container in any mainstream browser).
function encodeWav(buf: AudioBuffer): Blob {
  const numChannels = buf.numberOfChannels;
  const sampleRate = buf.sampleRate;
  const numFrames = buf.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(buf.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

async function recordAsWebm(buf: AudioBuffer): Promise<Blob> {
  const mimeType = "audio/webm; codecs=opus";
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    throw new Error("This browser doesn't support WebM audio recording.");
  }

  const ac = new AudioContext();
  const dest = ac.createMediaStreamDestination();
  const srcNode = ac.createBufferSource();
  srcNode.buffer = buf;
  srcNode.connect(dest);

  const recorder = new MediaRecorder(dest.stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => { ac.close(); resolve(new Blob(chunks, { type: mimeType })); };
    recorder.onerror = (e) => { ac.close(); reject(e); };
    recorder.start();
    srcNode.start();
    srcNode.onended = () => recorder.stop();
  });
}

// Stub for server-side-only formats (FLAC, AAC, M4A…)
async function serverSideStub(
  file: File,
  opts: AudioOptions,
  onProgress: (pct: number) => void,
  start: number
): Promise<ConversionResult> {
  // Not a stub any more. This used to wait six hundred milliseconds and then
  // say the conversion was "available in Phase 12"; Phase 12 was never built,
  // and the page saying so is linked from the navbar.
  void start;
  return await convertOnServer({
    file,
    target: opts.targetFormat,
    options: {
      // A 0-100 slider onto the bitrates the service will accept. Mapped here
      // rather than sent raw: the service takes a whole string from a list and
      // would refuse `quality=73`, and the honest place to translate a control
      // this page invented is next to the control.
      ...(typeof opts.quality === "number" ? { bitrate: bitrateFor(opts.quality) } : {}),
      ...(opts.normalize ? { normalize: true } : {}),
      ...(typeof opts.trimStart === "number" ? { start: String(opts.trimStart) } : {}),
      ...(typeof opts.trimEnd === "number"
        ? { duration: String(Math.max(opts.trimEnd - (opts.trimStart ?? 0), 0)) }
        : {}),
    },
    onProgress,
  });
}

/**
 * The nearest bitrate the service actually offers.
 *
 * Its allowlist is whole strings, so anything between them is refused rather
 * than rounded — which is the right behaviour there and would be a strange one
 * to show somebody who moved a slider.
 */
function bitrateFor(quality: number): string {
  if (quality >= 90) return "320k";
  if (quality >= 75) return "256k";
  if (quality >= 60) return "192k";
  if (quality >= 45) return "160k";
  if (quality >= 30) return "128k";
  if (quality >= 15) return "96k";
  return "64k";
}
