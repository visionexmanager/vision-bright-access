// ─── Audio Converter Module ───────────────────────────────────────────────────
// Browser-native path: uses MediaRecorder + AudioContext for format re-encoding.
// Heavy formats (FLAC, OPUS) are flagged server-side (canHandleInBrowser = false
// for those targets); they're dispatched to a Supabase Edge Function in Phase 12.

import type {
  ConverterModule,
  ConversionResult,
  AudioOptions,
  ConversionOptions,
} from "@/lib/types/fileStudio";
import { AUDIO_FORMATS } from "@/lib/types/fileStudio";

const BROWSER_OUTPUT_FORMATS = ["mp3", "wav", "ogg", "webm"];

export const AudioModule: ConverterModule = {
  moduleType: "audio",
  supportedInputFormats: [...AUDIO_FORMATS],
  supportedOutputFormats: [...AUDIO_FORMATS],
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

      // Re-encode via OfflineAudioContext + MediaRecorder
      const blob = await renderToBlob(trimmedBuffer, opts);
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

async function renderToBlob(
  buf: AudioBuffer,
  opts: AudioOptions
): Promise<Blob> {
  const offCtx = new OfflineAudioContext(
    buf.numberOfChannels,
    buf.length,
    buf.sampleRate
  );
  const src = offCtx.createBufferSource();
  src.buffer = buf;

  // Volume normalize (simple gain)
  const gain = offCtx.createGain();
  gain.gain.value = opts.normalize ? 1.2 : 1.0;
  src.connect(gain);
  gain.connect(offCtx.destination);
  src.start();
  await offCtx.startRendering();

  // Get a writable stream via MediaStreamDestination
  const ac = new AudioContext();
  const dest = ac.createMediaStreamDestination();
  const srcNode = ac.createBufferSource();
  srcNode.buffer = buf;
  srcNode.connect(dest);

  const mimeType = mediaRecorderMime(opts.targetFormat);
  const recorder = new MediaRecorder(dest.stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = (e) => reject(e);
    recorder.start();
    srcNode.start();
    srcNode.onended = () => {
      recorder.stop();
      ac.close();
    };
  });
}

function mediaRecorderMime(fmt: string): string {
  const map: Record<string, string> = {
    mp3:  "audio/mpeg",
    wav:  "audio/wav",
    ogg:  "audio/ogg; codecs=vorbis",
    webm: "audio/webm; codecs=opus",
  };
  return map[fmt] ?? "audio/webm";
}

// Stub for server-side-only formats (FLAC, AAC, M4A…)
async function serverSideStub(
  _file: File,
  opts: AudioOptions,
  onProgress: (pct: number) => void,
  start: number
): Promise<ConversionResult> {
  onProgress(15);
  await new Promise((r) => setTimeout(r, 600));
  onProgress(100);
  return {
    success: false,
    processingMs: Date.now() - start,
    error: `${opts.targetFormat.toUpperCase()} conversion requires server processing. Available in Phase 12 API integration.`,
  };
}
