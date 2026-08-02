# Visionex pre-production asset audit

Audit date: 2026-08-02  
Release state: **BLOCKED — no GitHub push or deployment permitted**

## Scope and production rules

The audit scanned `src`, `public`, the Arcade registries, asset references, image dimensions/formats, audio codec/sample-rate/bit-rate metadata, licence manifests, and placeholder/dummy/temporary markers. UI input placeholders and test-only example URLs were excluded because they are not media assets.

An asset is approved only when its origin or project ownership is documented, its technical quality passes the relevant gate, it is suitable for the event, and it has an accessible fallback where required. Generated imagery also remains subject to the organization's AI-generated-content policy review.

## Automated completion summary

| Result | Unique source assets | Registered/consumer uses |
| --- | ---: | ---: |
| New Full-HD Arcade visual masters | 18 | 54 cover/thumbnail/background registrations |
| Newly approved licensed Arcade audio | 3 | 3 audio registry slots |
| Placeholder notification icon replaced | 1 | 2 notification consumers |
| **Total repaired in this audit** | **22** | **59** |

These are additional to the three Full-HD game covers, Visionopoly SVG, and ten licensed Arcade sounds approved before this audit.

## Automatically repaired assets

### Arcade visual masters

All files below are project-owned generated images, WebP quality 84, 1920×1080, metadata-stripped, and registered as the cover, thumbnail and background master for the named game.

| File | Path | Game | Type | Previous readiness problem |
| --- | --- | --- | --- | --- |
| `game-word-puzzle-premium-v1.webp` | `src/assets/arcade/` | Word Puzzle | Cover/thumbnail/background | Legacy JPEG was 640×512 with undocumented provenance. |
| `game-hangman-premium-v1.webp` | `src/assets/arcade/` | Hangman | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |
| `game-akinator-premium-v1.webp` | `src/assets/arcade/` | Akinator | Cover/thumbnail/background | Akinator reused the unrelated LogiQuest cover. |
| `game-jungle-survival-premium-v1.webp` | `src/assets/arcade/` | Jungle Survival | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |
| `game-neon-breach-premium-v1.webp` | `src/assets/arcade/` | Neon Breach | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |
| `game-tactical-strike-premium-v1.webp` | `src/assets/arcade/` | Tactical Strike | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |
| `game-star-chef-premium-v1.webp` | `src/assets/arcade/` | Star Chef | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |
| `game-dream-home-premium-v1.webp` | `src/assets/arcade/` | Dream Home | Cover/thumbnail/background | Legacy JPEG was 800×512. First generated candidate contained text and was rejected; this is the clean replacement. |
| `game-music-ear-premium-v1.webp` | `src/assets/arcade/` | Music Ear Master | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |
| `game-fashion-designer-premium-v1.webp` | `src/assets/arcade/` | Fashion Designer | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |
| `game-uno-ultra-premium-v1.webp` | `src/assets/arcade/` | Uno Ultra | Cover/thumbnail/background | Legacy JPEG was 800×512; replacement uses original unbranded blank cards. |
| `game-dominoes-premium-v1.webp` | `src/assets/arcade/` | Dominoes | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |
| `game-farkle-premium-v1.webp` | `src/assets/arcade/` | Farkle | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |
| `game-briscola-premium-v1.webp` | `src/assets/arcade/` | Briscola | Cover/thumbnail/background | Legacy JPEG was 800×512; replacement uses newly invented card art. |
| `game-card-99-premium-v1.webp` | `src/assets/arcade/` | Card 99 | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |
| `game-logiquest-premium-v1.webp` | `src/assets/arcade/` | LogiQuest | Cover/thumbnail/background | Legacy JPEG was 800×512 and shared with Akinator. |
| `game-trade-tycoon-premium-v1.webp` | `src/assets/arcade/` | Trade Tycoon | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |
| `game-laptop-tech-premium-v1.webp` | `src/assets/arcade/` | Laptop Tech Master | Cover/thumbnail/background | Legacy JPEG was 800×512 and below Full HD. |

### Arcade audio

| File | Path | Games | Type | Source and correction |
| --- | --- | --- | --- | --- |
| `button-confirm.mp3` | `public/audio/arcade/` | All Arcade | Button effect | Mixkit SFX 2867, original WAV; mastered to 48 kHz/192 kbps at -18 LUFS target. |
| `puzzle-place.mp3` | `public/audio/arcade/` | Memory, Word Puzzle, LogiQuest, Neon Breach | Puzzle effect | Mixkit SFX 960, original WAV; mastered to 48 kHz/192 kbps at -18 LUFS target. |
| `natural-failure.mp3` | `public/audio/arcade/` | All Arcade | Failure resolve | Mixkit SFX 633, original WAV; respectful dark-orchestra cue, mastered to 48 kHz/192 kbps. |

Exact source pages, licence, item IDs and SHA-256 values are in `public/audio/arcade/ASSET_MANIFEST.md`.

### Placeholder removed from production consumers

| File/consumer | Path | Area | Type | Correction |
| --- | --- | --- | --- | --- |
| `placeholder.svg` reference | `src/components/PomodoroTimer.tsx` | Productivity | Notification icon | Replaced consumer reference with owned `/favicon.png`. |
| `placeholder.svg` reference | `src/components/MealReminders.tsx` | Health reminders | Notification icon | Replaced consumer reference with owned `/favicon.png`. |

## Requires human review — 11 blocked Arcade audio slots

These entries have no source and remain `replacement-required`; the runtime refuses to play them as premium audio.

| Registry ID / expected file | Registry path | Game | Type | Why automatic approval was refused |
| --- | --- | --- | --- | --- |
| `chess-piece-move` | `src/features/arcade/audio/audioLibrary.ts` | Future Chess | Wooden move | Free candidates were generic hard wood hits, not a controlled chess-piece placement recording. |
| `chess-piece-capture` | same | Future Chess | Wooden capture | Needs a distinct two-piece capture sound and perceptual comparison against the move cue. |
| `dice-roll` | same | Farkle, Visionopoly | Dice on wood | No suitable Mixkit recording was found; unrelated spin/coin sounds were rejected. |
| `car-gear-shift` | same | Velocity X Racing | Vehicle effect | Available free candidate was a motorcycle gear shift, not the required performance car. |
| `car-brake` | same | Velocity X Racing | Vehicle effect | Search results did not provide a clean isolated licensed brake recording. |
| `car-tire-screech` | same | Velocity X Racing | Vehicle effect | Needs a safe, realistic tyre-friction recording without clipping or embedded engine/music. |
| `narration-instructions` | same | All Arcade | Human narration | Script, Arabic/English voice casting, consent, pronunciation and localisation approval are required. |
| `kids-natural-guidance` | same | Visionex Kids | Child-friendly human voice | Requires safeguarding, consent/usage rights, age-appropriate script and native pronunciation review. |
| `music-menu` | same | All Arcade | Looping music | Requires brand-level composition selection, loop-point review and commercial music policy approval. |
| `music-active` | same | All Arcade | Adaptive music | Must match the menu cue harmonically and loop seamlessly under gameplay. |
| `music-danger` | same | All Arcade | Adaptive music | Must transition cleanly from active music without distressing or inaccessible intensity. |

## Legacy Arcade rasters — no longer referenced, cleanup candidates

The following 20 JPEGs have been superseded by documented premium WebP/SVG assets. They are not production blockers and were not deleted because this phase requested audit/replacement, not destructive cleanup:

`game-briscola.jpg`, `game-card99.jpg`, `game-dominoes.jpg`, `game-dreamhome.jpg`, `game-earmaster.jpg`, `game-farkle.jpg`, `game-fashion.jpg`, `game-hangman.jpg`, `game-jungle.jpg`, `game-laptoptech.jpg`, `game-logiquest.jpg`, `game-memory.jpg`, `game-neonbreach.jpg`, `game-quiz.jpg`, `game-starchef.jpg`, `game-tactical.jpg`, `game-tradetycoon.jpg`, `game-uno.jpg`, `game-velocity.jpg`, and `game-word.jpg` in `src/assets/`.

Reason: 640×512 or 800×512 JPEG, no retained source/licence record, and replaced in the current catalogue. Human action: approve deletion in a dedicated cleanup commit after confirming no external/static consumer depends on their old paths.

## Non-Arcade legacy raster review queue

The full-project scan identified 39 raster files below 1280 px width outside Arcade. They are not automatically classified as broken, but they cannot be promoted to the new Full-HD/Retina standard because their source ownership and intended crop were not documented. Automatically replacing them would alter unrelated Academy, Services and Simulator surfaces without product-owner approval.

| Group | Paths | Type | Reason for human review |
| --- | --- | --- | --- |
| Core illustrations | `src/assets/academy-illustration.jpg`, `community-illustration.jpg`, `dashboard-illustration.jpg`, `games-illustration.jpg`, `news-illustration.jpg`, `services-illustration.jpg`, `simulators-illustration.jpg` | Page illustration | 800×512 legacy JPEG; verify ownership and redesign intent. |
| Service cards | `src/assets/service-career.jpg`, `service-consulting.jpg`, `service-digital-marketing.jpg`, `service-import.jpg`, `service-music.jpg`, `service-studio.jpg`, `service-training.jpg`, `service-web-design.jpg` | Card image | 640×512 or 800×512; no provenance manifest. |
| Simulator cards A–M | `src/assets/sim-aluminum.jpg`, `sim-barber.jpg`, `sim-board.jpg`, `sim-cattle.jpg`, `sim-chocolate.jpg`, `sim-dairy.jpg`, `sim-detergent.jpg`, `sim-english.jpg`, `sim-hvac.jpg`, `sim-incubator.jpg`, `sim-kitchen.jpg`, `sim-laptop.jpg`, `sim-logistics.jpg` | Simulator image | 768×512; below HD and needs simulator-specific visual sign-off. |
| Simulator cards N–Z | `src/assets/sim-mobile.jpg`, `sim-music.jpg`, `sim-network.jpg`, `sim-perfume.jpg`, `sim-poultry.jpg`, `sim-sheep.jpg`, `sim-skincare.jpg`, `sim-solar.jpg`, `sim-trade.jpg`, `sim-wood.jpg` | Simulator image | 768×512; below HD and needs simulator-specific visual sign-off. |
| Brand logo | `src/assets/logo.png` | Logo raster | 240×160; must be replaced from an approved vector brand master, not AI-generated. |

## Licensed reaction-audio library requiring perceptual sampling

The 112 files under `public/audio/reactions/emoji/` have per-file Openverse/Freesound attribution in `ATTRIBUTION.md` and are technically valid 44.1 kHz mono derivatives. They are not missing assets. Human sampling is still recommended because several semantic mappings use expressive human recordings and suitability cannot be proven from metadata alone. This is a content-QA recommendation, not a licensing blocker.

## Final counts and release decision

| Category | Count | Status |
| --- | ---: | --- |
| Automatically repaired unique assets | 22 | Integrated and technically validated |
| Remaining blocked Arcade assets | 11 | Human production/licensing review required |
| Superseded Arcade JPEGs | 20 | Cleanup approval required; not runtime blockers |
| Non-Arcade low-resolution/provenance review queue | 39 | Human visual/brand review required |
| Reaction sounds recommended for perceptual sampling | 112 | Licensed; not a release-blocking absence |

Production publication remains blocked by the 11 premium audio slots, manual perceptual audio review, postponed assistive-technology testing, and organization approval of generated-image policy. No GitHub push, release or site deployment was performed.
