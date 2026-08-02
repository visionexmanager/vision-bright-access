# Visionex Arcade audio production contract

The registry is the only supported route for new Arcade audio. Pending entries are intentionally silent: the engine blocks them until the source, licence, and mastering review are approved.

## Acceptance gate

- Record or commission realistic material appropriate to the event; do not use preview, placeholder, cartoon, or provenance-unknown files.
- Keep a lossless 48 kHz / 24-bit WAV master. Deliver an Opus web version (160 kbps or better for effects, higher when music requires it) and an AAC fallback where browser coverage requires it.
- Remove clipping, hum, abrupt edits, excess noise, and baked-in loudness processing. Use clean loop boundaries for ambience and music.
- Target approximately -23 LUFS for looping music, -24 LUFS for ambience, -18 LUFS for effects, and -16 LUFS for narration/victory cues; validate peaks during a full game mix.
- Record source/creator, usage scope, attribution text, licence identifier, approval date, and supported games in `audioLibrary.ts`.
- Test headphones and device speakers on current Chromium, Firefox, Safari, iOS, and Android. Confirm event fit, intelligibility, balance, loop quality, latency, and no audible distortion.

## Adding an approved sound

1. Place web-optimised files under a stable Arcade asset path and retain the lossless master outside the web bundle.
2. Replace the pending registry entry with `quality: "production"`, `licenseStatus: "approved"`, complete attribution/licence fields, and one or more source records including codec, sample rate, bit rate, and file size.
3. Run the audio quality tests. A failed gate means the engine will refuse playback.
4. Call `advancedAudioEngine.preload(id)` only near the interaction that needs it, then `play(id, options)`. Pass `{ position: { x, y, z } }` for spatial-ready events.
5. Re-test with mute and every channel slider, high-quality mode, screen-reader mode, keyboard-only input, mobile autoplay rules, and interrupted/resumed sessions.

Dynamic music uses `DynamicMusicController.transition(state)`. Voice playback automatically ducks the music bus. Accessible event narration is routed through `AccessibilityAudioLayer` and respects Screen Reader Mode.
