import { readGameSettings } from "../core/gameSettings";
import { audioLibrary } from "./audioLibrary";
import { validateAudioAsset } from "./audioQuality";
import type { AudioAssetDefinition, AudioPlayOptions, SpatialPosition } from "./types";
import type { AudioChannel } from "../core/types";

type ActiveVoice = { source: AudioBufferSourceNode; gain: GainNode; assetId: string; channel: AudioChannel };

export class AdvancedAudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private buses = new Map<AudioChannel, GainNode>();
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer>>();
  private voices = new Set<ActiveVoice>();
  private assetVoices = new Map<string, Set<ActiveVoice>>();
  private maxCachedBuffers = 48;

  private ensureGraph() {
    if (this.context) return this.context;
    const context = new AudioContext({ latencyHint:"interactive" });
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -8;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    master.connect(compressor).connect(context.destination);
    (["music","effects","ambient","voice"] as AudioChannel[]).forEach((channel) => {
      const bus = context.createGain();
      bus.connect(master);
      this.buses.set(channel, bus);
    });
    this.context = context;
    this.master = master;
    this.compressor = compressor;
    this.applySettings();
    window.addEventListener("visionex:arcade-settings", () => this.applySettings());
    return context;
  }

  async unlock() {
    const context = this.ensureGraph();
    if (context.state === "suspended") await context.resume();
  }

  applySettings() {
    if (!this.context || !this.master) return;
    const settings = readGameSettings();
    const at = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : 1, at, 0.015);
    const levels: Record<AudioChannel, number> = { music:settings.musicVolume, effects:settings.effectsVolume, ambient:settings.ambientVolume, voice:settings.voiceVolume };
    for (const [channel, bus] of this.buses) bus.gain.setTargetAtTime(levels[channel] / 100, at, 0.02);
  }

  async preload(assetId: string) {
    const asset = this.requirePlayableAsset(assetId);
    const source = this.selectSource(asset);
    if (this.buffers.has(source.src)) return this.buffers.get(source.src)!;
    if (this.pending.has(source.src)) return this.pending.get(source.src)!;
    const job = this.fetchAndDecode(source.src);
    this.pending.set(source.src, job);
    try {
      const buffer = await job;
      if (this.buffers.size >= this.maxCachedBuffers) this.buffers.delete(this.buffers.keys().next().value as string);
      this.buffers.set(source.src, buffer);
      return buffer;
    } finally { this.pending.delete(source.src); }
  }

  async play(assetId: string, options: AudioPlayOptions = {}) {
    await this.unlock();
    const context = this.context!;
    const asset = this.requirePlayableAsset(assetId);
    const buffer = await this.preload(assetId);
    const existing = this.assetVoices.get(assetId) ?? new Set<ActiveVoice>();
    while (existing.size >= (asset.maxInstances ?? 4)) {
      const oldest = existing.values().next().value as ActiveVoice;
      this.stopVoice(oldest, 0.015);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? asset.loop ?? false;
    source.playbackRate.value = options.playbackRate ?? 1;
    const gain = context.createGain();
    gain.gain.value = Math.max(0, Math.min(1.5, options.volume ?? 1));
    source.connect(gain);
    const output = options.position ? this.createSpatialNode(options.position, gain) : gain;
    output.connect(this.buses.get(asset.channel)!);
    const voice = { source, gain, assetId, channel:asset.channel };
    existing.add(voice); this.assetVoices.set(assetId, existing); this.voices.add(voice);
    if (asset.channel === "voice" || options.duckMusic) this.duckMusic(true);
    source.addEventListener("ended", () => {
      this.cleanupVoice(voice);
      if (asset.channel === "voice" || options.duckMusic) this.duckMusic(false);
    }, { once:true });
    source.start();
    return voice;
  }

  stop(assetId: string, fadeSeconds = 0.08) {
    this.assetVoices.get(assetId)?.forEach((voice) => this.stopVoice(voice, fadeSeconds));
  }

  stopChannel(channel: AudioChannel, fadeSeconds = 0.08) {
    [...this.voices].filter((voice) => voice.channel === channel).forEach((voice) => this.stopVoice(voice, fadeSeconds));
  }

  stopAll(fadeSeconds = 0.08) { [...this.voices].forEach((voice) => this.stopVoice(voice, fadeSeconds)); }
  release(assetId?: string) {
    if (!assetId) { this.buffers.clear(); return; }
    const asset = audioLibrary.get(assetId); if (!asset) return;
    asset.sources.forEach((source) => this.buffers.delete(source.src));
  }
  cacheSize() { return this.buffers.size; }

  private async fetchAndDecode(src: string) {
    const response = await fetch(src, { cache:"force-cache" });
    if (!response.ok) throw new Error(`Audio download failed (${response.status})`);
    return this.context!.decodeAudioData(await response.arrayBuffer());
  }

  private requirePlayableAsset(assetId: string) {
    const asset = audioLibrary.get(assetId);
    if (!asset) throw new Error(`Unknown audio asset: ${assetId}`);
    const audit = validateAudioAsset(asset);
    if (!audit.valid) throw new Error(`Audio asset ${assetId} is blocked: ${audit.errors.join(", ")}`);
    return asset;
  }

  private selectSource(asset: AudioAssetDefinition) {
    const highQuality = readGameSettings().highQualityAudio;
    const order = highQuality ? ["wav","opus","aac","mp3"] : ["opus","aac","mp3","wav"];
    const source = [...asset.sources].sort((a, b) => order.indexOf(a.codec) - order.indexOf(b.codec))[0];
    if (!source) throw new Error(`Audio asset ${asset.id} has no approved source`);
    return source;
  }

  private createSpatialNode(position: SpatialPosition, input: AudioNode) {
    const panner = this.context!.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 1;
    panner.maxDistance = 10_000;
    panner.rolloffFactor = 1;
    panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z;
    input.connect(panner);
    return panner;
  }

  private duckMusic(active: boolean) {
    if (!this.context) return;
    const music = this.buses.get("music"); if (!music) return;
    const settings = readGameSettings();
    music.gain.cancelScheduledValues(this.context.currentTime);
    music.gain.setTargetAtTime(active ? (settings.musicVolume / 100) * 0.28 : settings.musicVolume / 100, this.context.currentTime, active ? 0.04 : 0.22);
  }

  private stopVoice(voice: ActiveVoice, fadeSeconds: number) {
    if (!this.context || !this.voices.has(voice)) return;
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, Math.max(0.005, fadeSeconds / 3));
    try { voice.source.stop(now + fadeSeconds); } catch { /* already stopped */ }
    window.setTimeout(() => this.cleanupVoice(voice), (fadeSeconds + 0.05) * 1000);
  }

  private cleanupVoice(voice: ActiveVoice) {
    this.voices.delete(voice);
    this.assetVoices.get(voice.assetId)?.delete(voice);
    voice.source.disconnect(); voice.gain.disconnect();
  }
}

export const advancedAudioEngine = new AdvancedAudioEngine();
