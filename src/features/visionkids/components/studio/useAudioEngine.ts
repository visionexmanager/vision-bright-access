import { useCallback, useRef, useState } from "react";

/** Minimal Web Audio synth + a real recorder tapped off the same
 *  destination, so "save my song" produces an actual playable audio file,
 *  not just a note-sequence JSON. Shared by Music Studio (piano/drums) and
 *  reusable by anything else that needs simple tone playback + capture. */
export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      ctxRef.current = ctx;
      destRef.current = dest;
    }
    return { ctx: ctxRef.current, dest: destRef.current! };
  }, []);

  const playTone = useCallback((frequency: number, durationMs = 400, type: OscillatorType = "sine") => {
    const { ctx, dest } = ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination); // audible to the child
    gain.connect(dest); // also captured for recording/export
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  }, [ensureContext]);

  const playNoiseBurst = useCallback((durationMs = 150, filterFreq = 4000) => {
    const { ctx, dest } = ensureContext();
    const bufferSize = ctx.sampleRate * (durationMs / 1000);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(dest);
    noise.start();
  }, [ensureContext]);

  const startRecording = useCallback(() => {
    const { dest } = ensureContext();
    chunksRef.current = [];
    const recorder = new MediaRecorder(dest.stream);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  }, [ensureContext]);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) { resolve(new Blob()); return; }
      recorder.onstop = () => {
        setIsRecording(false);
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      };
      recorder.stop();
    });
  }, []);

  return { playTone, playNoiseBurst, startRecording, stopRecording, isRecording };
}
